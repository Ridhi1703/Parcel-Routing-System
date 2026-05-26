from typing import Any
from app.schemas.rule import RuleConfig, Rule
from app.services.rules.base import BaseRule


class DynamicRuleExecutor(BaseRule):

    def __init__(self, config: RuleConfig):
        self.config = config

    def evaluate(self, parcel: dict):

        sorted_rules = sorted(self.config.rules, key=lambda r: r.priority)

        for rule in sorted_rules:

            if self._evaluate_rule(rule, parcel):

                updates = {}

                if rule.action == "ROUTE_TO":
                    updates["decision"] = rule.target

                if rule.action == "INSURANCE_HOLD":
                    updates["decision"] = "INSURANCE_HOLD"

                return self.match(
                    updates=updates,
                    reasons=[f"Dynamic rule matched: {rule.id}"],
                    matched_rules=[rule.id],
                    rules_evaluated=[
                        {
                            "rule_id": rule.id,
                            "source": "DYNAMIC",
                            "matched": True,
                        }
                    ],
                )

        return self.no_match()

    def _evaluate_rule(self, rule: Rule, parcel: dict[str, Any]) -> bool:

        if rule.logic == "OR":
            return any(
                self._evaluate_condition(c, parcel)
                for c in rule.conditions
            )

        return all(
            self._evaluate_condition(c, parcel)
            for c in rule.conditions
        )

    def _evaluate_condition(self, cond, parcel):

        val = parcel.get(cond.field)

        if val is None:
            return False

        match cond.operator:
            case "gt":
                return val > cond.value
            case "gte":
                return val >= cond.value
            case "lt":
                return val < cond.value
            case "lte":
                return val <= cond.value
            case "eq":
                return val == cond.value
            case "neq":
                return val != cond.value
            case _:
                return False