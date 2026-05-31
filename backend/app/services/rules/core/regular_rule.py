from app.services.rules.base import BaseRule


class RegularRule(BaseRule):

    priority = 3              # ← UI priority 3
    sets_decision = True

    def evaluate(self, parcel: dict):

        if float(parcel["weight_kg"]) <= 10:
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
        return self.no_match()