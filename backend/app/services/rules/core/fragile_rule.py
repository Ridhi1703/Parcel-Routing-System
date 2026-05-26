from app.services.rules.base import BaseRule


class FragileRule(BaseRule):

    def evaluate(self, parcel: dict):

        fragile = parcel.get("fragile", False)

        if fragile:
            return self.match(
                updates={"requires_special_handling": True},
                reasons=["Parcel marked as fragile"],
                matched_rules=["CORE_FRAGILE_RULE"],
                rules_evaluated=[
                    {
                        "rule_id": "CORE_FRAGILE_RULE",
                        "source": "CORE",
                        "matched": True,
                    }
                ],
            )

        return self.no_match()