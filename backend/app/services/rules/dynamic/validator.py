from typing import Any
from app.schemas.rule import RuleConfig, Rule, RuleCondition


def validate_rule_config(config: RuleConfig) -> list[str]:
    """Return list of validation errors. Empty list = valid."""
    errors: list[str] = []

    priorities = [r.priority for r in config.rules]
    if len(priorities) != len(set(priorities)):
        errors.append("Duplicate priorities detected")

    for rule in config.rules:
        if not rule.conditions:
            errors.append(f"Rule '{rule.id}': must have at least one condition")
        if rule.action == "ROUTE_TO" and rule.target is None:
            errors.append(f"Rule '{rule.id}': ROUTE_TO requires a target")
        if rule.logic not in ("AND", "OR"):
            errors.append(f"Rule '{rule.id}': logic must be AND or OR")

    if config.fallback not in ("DEAD_LETTER", "INSURANCE_HOLD"):
        errors.append(f"Invalid fallback '{config.fallback}'")

    return errors


def _resolve_field(field: str, parcel: dict[str, Any]) -> Any:
    """
    Resolve a field path from a parcel dict.

    Supports:
      "weight_kg"              → parcel["weight_kg"]
      "attributes.expensive"   → parcel["attributes"]["expensive"]  (dot-notation, legacy)
      "expensive"              → parcel["expensive"] if present,
                                 else parcel["attributes"]["expensive"]  (bare name, new style)
    """
    if "." in field:
        parent_key, child_key = field.split(".", 1)
        parent = parcel.get(parent_key)
        if not isinstance(parent, dict):
            return None
        return parent.get(child_key)
    # Top-level first; fall back to attributes dict for custom fields
    val = parcel.get(field)
    if val is None:
        attrs = parcel.get("attributes")
        if isinstance(attrs, dict):
            return attrs.get(field)
    return val


def _is_numeric(v: Any) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def _evaluate_single_condition(cond: RuleCondition, parcel: dict[str, Any]) -> bool:
    parcel_val = _resolve_field(cond.field, parcel)
    if parcel_val is None:
        return False

    op = cond.operator
    threshold = cond.value

    # String comparison — use when either side is non-numeric
    if not _is_numeric(parcel_val) or not _is_numeric(threshold):
        pv = str(parcel_val).strip().lower()
        tv = str(threshold).strip().lower()
        match op:
            case "eq":
                return pv == tv
            case "neq":
                return pv != tv
            case _:
                return False  # gt/lt meaningless on strings

    # Numeric comparison
    pv_f = float(parcel_val)
    tv_f = float(threshold)
    match op:
        case "gt":
            return pv_f > tv_f
        case "gte":
            return pv_f >= tv_f
        case "lt":
            return pv_f < tv_f
        case "lte":
            return pv_f <= tv_f
        case "eq":
            return pv_f == tv_f
        case "neq":
            return pv_f != tv_f
        case _:
            return False


def _evaluate_rule(rule: Rule, parcel: dict[str, Any]) -> bool:
    """Evaluate all conditions in a rule using AND (default) or OR logic."""
    if not rule.conditions:
        return False
    if rule.logic == "OR":
        return any(_evaluate_single_condition(c, parcel) for c in rule.conditions)
    # AND (default)
    return all(_evaluate_single_condition(c, parcel) for c in rule.conditions)


def evaluate_rules(
    config: RuleConfig, parcel: dict[str, Any]
) -> tuple[str, list[dict[str, Any]]]:
    """
    Evaluate the rule chain against a parcel.
    Returns (decision, rules_evaluated).
    """
    rules_evaluated: list[dict[str, Any]] = []
    sorted_rules = sorted(config.rules, key=lambda r: r.priority)

    for rule in sorted_rules:
        matched = _evaluate_rule(rule, parcel)
        entry: dict[str, Any] = {
            "rule_id": rule.id,
            "priority": rule.priority,
            "matched": matched,
            "logic": rule.logic,
            "conditions_count": len(rule.conditions),
        }

        if matched:
            if rule.action == "INSURANCE_HOLD":
                entry["result"] = "INSURANCE_HOLD"
                rules_evaluated.append(entry)
                return "INSURANCE_HOLD", rules_evaluated
            elif rule.action == "ROUTE_TO" and rule.target:
                entry["result"] = rule.target
                rules_evaluated.append(entry)
                return rule.target, rules_evaluated
        else:
            entry["result"] = "not applicable"
            rules_evaluated.append(entry)

    return config.fallback, rules_evaluated
