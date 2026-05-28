from typing import Any

from app.schemas.rule import RuleConfig, Rule
from app.services.rules.base import BaseRule


class DynamicRuleExecutor(BaseRule):

    def __init__(self, config: RuleConfig):
        self.config = config

    def evaluate(self, parcel: dict):

        # Evaluate rules by ascending priority
        sorted_rules = sorted(
            self.config.rules,
            key=lambda r: r.priority
        )

        # FIRST MATCH WINS
        for rule in sorted_rules:

            matched = self._evaluate_rule(
                rule,
                parcel,
            )

            if not matched:
                continue

            updates = {}

            # Terminal / special actions
            TERMINAL_ACTIONS = {
                "INSURANCE_HOLD": "INSURANCE_HOLD",
            }

            # Built-in routing action
            if rule.action == "ROUTE_TO":

                updates["decision"] = (
                    rule.target
                    if rule.target
                    else "UNKNOWN_ROUTE"
                )

                updates["action_type"] = rule.action

            # Built-in terminal actions
            elif rule.action in TERMINAL_ACTIONS:

                updates["decision"] = (
                    TERMINAL_ACTIONS[
                        rule.action
                    ]
                )

                updates["action_type"] = rule.action

            # Generic custom actions
            else:

                updates["action_type"] = rule.action

                # Route/decision destination
                if rule.target:
                    updates["decision"] = rule.target
                else:
                    updates["decision"] = rule.action

            print("\n========== RULE MATCHED ==========")
            print("RULE ID:", rule.id)
            print("ACTION:", rule.action)
            print("TARGET:", rule.target)
            print("UPDATES:", updates)
            print("==================================\n")

            # FIRST MATCH WINS
            return self.match(
                updates=updates,
                reasons=[
                    (
                        "Dynamic rule matched: "
                        f"{rule.id}"
                    )
                ],
                matched_rules=[rule.id],
                rules_evaluated=[
                    {
                        "rule_id": rule.id,
                        "source": "DYNAMIC",
                        "matched": True,
                        "priority": rule.priority,
                        "decision": updates["decision"],
                        "action": rule.action,
                    }
                ],
            )

        return self.no_match()

    def _resolve_field(
        self,
        field: str,
        parcel: dict,
    ):

        # Direct parcel fields
        if field in parcel:
            return parcel[field]

        # Custom attributes
        attrs = parcel.get(
            "attributes",
            {},
        )

        return attrs.get(field)

    def _evaluate_rule(
        self,
        rule: Rule,
        parcel: dict[str, Any],
    ) -> bool:

        # OR logic
        if rule.logic == "OR":

            return any(
                self._evaluate_condition(
                    c,
                    parcel,
                )
                for c in rule.conditions
            )

        # AND logic
        return all(
            self._evaluate_condition(
                c,
                parcel,
            )
            for c in rule.conditions
        )

    def _evaluate_condition(
        self,
        cond,
        parcel,
    ):

        val = self._resolve_field(
            cond.field,
            parcel,
        )

        if val is None:
            return False

        threshold = cond.value

        op = (
            str(cond.operator)
            .strip()
            .lower()
        )

        # Normalize operators from frontend
        OPERATOR_MAP = {
            "=": "eq",
            "==": "eq",
            "equals": "eq",
            "equal": "eq",

            "!=": "neq",
            "<>": "neq",
            "not_equals": "neq",
            "not equal": "neq",

            ">": "gt",
            "greater_than": "gt",
            "greater than": "gt",

            ">=": "gte",
            "greater_or_equal": "gte",
            "greater or equal": "gte",
            "greater_than_or_equal": "gte",

            "<": "lt",
            "less_than": "lt",
            "less than": "lt",

            "<=": "lte",
            "less_or_equal": "lte",
            "less or equal": "lte",
            "less_than_or_equal": "lte",
        }

        op = OPERATOR_MAP.get(op, op)

        # STRING COMPARISON
        if (
            isinstance(val, str)
            or isinstance(threshold, str)
        ):

            val_str = (
                str(val)
                .strip()
                .lower()
            )

            threshold_str = (
                str(threshold)
                .strip()
                .lower()
            )

            match op:

                case "eq":
                    return val_str == threshold_str

                case "neq":
                    return val_str != threshold_str

                case _:
                    return False

        # NUMERIC COMPARISON
        try:

            val_num = float(val)
            threshold_num = float(threshold)

        except Exception:
            return False

        match op:

            case "gt":
                return val_num > threshold_num

            case "gte":
                return val_num >= threshold_num

            case "lt":
                return val_num < threshold_num

            case "lte":
                return val_num <= threshold_num

            case "eq":
                return val_num == threshold_num

            case "neq":
                return val_num != threshold_num

            case _:
                return False
