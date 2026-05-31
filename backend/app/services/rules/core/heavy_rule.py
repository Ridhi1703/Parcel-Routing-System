from app.services.rules.base import BaseRule


class HeavyRule(BaseRule):

    priority = 4              # ← UI priority 4
    sets_decision = True

    def evaluate(self, parcel: dict):

        if float(parcel["weight_kg"]) > 10:
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
        return self.no_match()