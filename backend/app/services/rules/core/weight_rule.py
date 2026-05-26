from app.services.rules.base import BaseRule


class WeightRule(BaseRule):

    def evaluate(self, parcel: dict):

        weight = float(parcel["weight_kg"])

        if weight <= 1:
            return self.match(
                updates={"decision": "Mail Department"},
                reasons=["Weight <= 1kg"],
                matched_rules=["CORE_WEIGHT_MAIL"],
                rules_evaluated=[
                    {
                        "rule_id": "CORE_WEIGHT_MAIL",
                        "source": "CORE",
                        "matched": True,
                    }
                ],
            )

        if weight <= 10:
            return self.match(
                updates={"decision": "Regular Department"},
                reasons=["Weight <= 10kg"],
                matched_rules=["CORE_WEIGHT_REGULAR"],
                rules_evaluated=[
                    {
                        "rule_id": "CORE_WEIGHT_REGULAR",
                        "source": "CORE",
                        "matched": True,
                    }
                ],
            )

        return self.match(
            updates={"decision": "Heavy Department"},
            reasons=["Weight > 10kg"],
            matched_rules=["CORE_WEIGHT_HEAVY"],
            rules_evaluated=[
                {
                    "rule_id": "CORE_WEIGHT_HEAVY",
                    "source": "CORE",
                    "matched": True,
                }
            ],
        )