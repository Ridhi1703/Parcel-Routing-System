import pytest
from app.schemas.rule import RuleConfig, Rule, RuleCondition
from app.services.rule_engine import evaluate_rules, validate_rule_config

# ── Fixtures ──────────────────────────────────────────────────────────────────
# Old single-condition format — must still work (backward compat)
DEFAULT_CONFIG = {
    "version": 1,
    "rules": [
        {
            "id": "insurance-gate",
            "type": "value_threshold",
            "condition": {"field": "value_eur", "operator": "gt", "value": 1000},
            "action": "INSURANCE_HOLD",
            "priority": 1,
        },
        {
            "id": "mail-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "lte", "value": 1},
            "action": "ROUTE_TO",
            "target": "Mail Department",
            "priority": 2,
        },
        {
            "id": "regular-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "lte", "value": 10},
            "action": "ROUTE_TO",
            "target": "Regular Department",
            "priority": 3,
        },
        {
            "id": "heavy-dept",
            "type": "weight_range",
            "condition": {"field": "weight_kg", "operator": "gt", "value": 10},
            "action": "ROUTE_TO",
            "target": "Heavy Department",
            "priority": 4,
        },
    ],
    "fallback": "DEAD_LETTER",
}

# New multi-condition format
MULTI_CONDITION_CONFIG = {
    "version": 2,
    "rules": [
        {
            "id": "secure-expensive",
            "conditions": [
                {"field": "attributes.expensive", "operator": "eq", "value": "yes"},
            ],
            "logic": "AND",
            "action": "ROUTE_TO",
            "target": "Secure Route",
            "priority": 1,
        },
        {
            "id": "mail-light-cheap",
            "conditions": [
                {"field": "weight_kg", "operator": "lte", "value": 1},
                {"field": "value_eur", "operator": "lte", "value": 500},
            ],
            "logic": "AND",
            "action": "ROUTE_TO",
            "target": "Mail Department",
            "priority": 2,
        },
        {
            "id": "hold-or-heavy",
            "conditions": [
                {"field": "value_eur", "operator": "gt", "value": 1000},
                {"field": "weight_kg", "operator": "gt", "value": 10},
            ],
            "logic": "OR",
            "action": "INSURANCE_HOLD",
            "priority": 3,
        },
    ],
    "fallback": "DEAD_LETTER",
}


def get_config():
    return RuleConfig.model_validate(DEFAULT_CONFIG)


def get_multi_config():
    return RuleConfig.model_validate(MULTI_CONDITION_CONFIG)


# ── Backward compatibility ────────────────────────────────────────────────────
class TestBackwardCompat:
    def test_single_condition_migrated_to_list(self):
        rule = Rule.model_validate(DEFAULT_CONFIG["rules"][0])
        assert len(rule.conditions) == 1
        assert rule.conditions[0].field == "value_eur"

    def test_old_config_still_evaluates(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 0.5, "value_eur": 1500})
        assert decision == "INSURANCE_HOLD"


# ── Single-condition rules (via backward compat) ──────────────────────────────
class TestRuleEngine:
    def test_insurance_hold_high_value(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 0.5, "value_eur": 1500})
        assert decision == "INSURANCE_HOLD"

    def test_mail_dept_light_parcel(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 0.5, "value_eur": 49.99})
        assert decision == "Mail Department"

    def test_regular_dept_medium_parcel(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 3.0, "value_eur": 89.50})
        assert decision == "Regular Department"

    def test_heavy_dept_heavy_parcel(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 15.0, "value_eur": 200})
        assert decision == "Heavy Department"

    def test_insurance_takes_priority_over_weight(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 0.3, "value_eur": 2000})
        assert decision == "INSURANCE_HOLD"

    def test_rules_evaluated_list_order(self):
        config = get_config()
        _, rules_evaluated = evaluate_rules(config, {"weight_kg": 3.0, "value_eur": 50})
        assert rules_evaluated[0]["rule_id"] == "insurance-gate"
        assert rules_evaluated[0]["matched"] is False
        assert rules_evaluated[1]["rule_id"] == "mail-dept"
        assert rules_evaluated[1]["matched"] is False
        assert rules_evaluated[2]["rule_id"] == "regular-dept"
        assert rules_evaluated[2]["matched"] is True

    def test_boundary_exactly_1kg(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 1.0, "value_eur": 50})
        assert decision == "Mail Department"

    def test_boundary_just_over_1kg(self):
        config = get_config()
        decision, _ = evaluate_rules(config, {"weight_kg": 1.001, "value_eur": 50})
        assert decision == "Regular Department"


# ── Multi-condition AND logic ─────────────────────────────────────────────────
class TestMultiConditionAND:
    def test_and_all_match(self):
        """mail-light-cheap: weight ≤ 1 AND value ≤ 500 — both satisfied."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 0.5,
                "value_eur": 200,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        assert decision == "Mail Department"

    def test_and_partial_fails(self):
        """weight ≤ 1 but value > 500 → AND fails → falls through."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 0.5,
                "value_eur": 800,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        # mail-light-cheap fails (value > 500), hold-or-heavy: value > 1000? no — fallback
        assert decision == "DEAD_LETTER"


# ── Multi-condition OR logic ──────────────────────────────────────────────────
class TestMultiConditionOR:
    def test_or_first_condition_matches(self):
        """value_eur > 1000 alone triggers INSURANCE_HOLD via OR rule."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 0.5,
                "value_eur": 1500,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        assert decision == "INSURANCE_HOLD"

    def test_or_second_condition_matches(self):
        """weight_kg > 10 alone triggers INSURANCE_HOLD via OR rule."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 15.0,
                "value_eur": 50,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        assert decision == "INSURANCE_HOLD"

    def test_or_neither_matches(self):
        """Neither OR condition triggers AND mail rule also misses → DEAD_LETTER.
        weight=5 (> 1 so mail misses), value=50 (≤ 1000 so insurance misses)."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 5.0,
                "value_eur": 50,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        assert decision == "DEAD_LETTER"


# ── Attribute routing ─────────────────────────────────────────────────────────
class TestAttributeRouting:
    def test_attribute_eq_string_matches(self):
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 999,
                "value_eur": 1,
                "destination_country": "IN",
                "attributes": {"expensive": "yes"},
            },
        )
        assert decision == "Secure Route"

    def test_attribute_eq_case_insensitive(self):
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 1,
                "value_eur": 1,
                "destination_country": "IN",
                "attributes": {"expensive": "YES"},
            },
        )
        assert decision == "Secure Route"

    def test_attribute_missing_no_match(self):
        """No expensive attribute + weight=5 (misses mail) + value=50 (misses insurance) → DEAD_LETTER."""
        config = get_multi_config()
        decision, _ = evaluate_rules(
            config,
            {
                "weight_kg": 5.0,
                "value_eur": 50,
                "destination_country": "IN",
                "attributes": {},
            },
        )
        assert decision == "DEAD_LETTER"


# ── Validation ────────────────────────────────────────────────────────────────
class TestRuleValidation:
    def test_valid_config_no_errors(self):
        assert validate_rule_config(get_config()) == []

    def test_valid_multi_config_no_errors(self):
        assert validate_rule_config(get_multi_config()) == []

    def test_duplicate_priorities_flagged(self):
        bad = {
            **DEFAULT_CONFIG,
            "rules": [
                {**DEFAULT_CONFIG["rules"][0], "priority": 1},
                {**DEFAULT_CONFIG["rules"][1], "priority": 1},
            ],
        }
        errors = validate_rule_config(RuleConfig.model_validate(bad))
        assert any("Duplicate" in e for e in errors)

    def test_custom_target_allowed(self):
        cfg = {
            **DEFAULT_CONFIG,
            "rules": [{**DEFAULT_CONFIG["rules"][1], "target": "Secure Route"}],
        }
        errors = validate_rule_config(RuleConfig.model_validate(cfg))
        assert errors == []

    def test_route_to_without_target_flagged(self):
        cfg = RuleConfig.model_validate(DEFAULT_CONFIG)
        cfg.rules[0].action = "ROUTE_TO"
        cfg.rules[0].target = None
        errors = validate_rule_config(cfg)
        assert any("requires" in e for e in errors)
