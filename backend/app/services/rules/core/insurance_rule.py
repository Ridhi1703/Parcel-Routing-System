from app.services.rules.base import BaseRule


class InsuranceRule(BaseRule):
    
    priority = 1             
    sets_decision = True 

    def evaluate(self, parcel: dict):

        value = float(parcel["value_eur"])

        if value > 1000:
            return self.match(
                updates={"insurance_required": True},
                reasons=["Parcel value exceeds €1000"],
                matched_rules=["CORE_INSURANCE_RULE"],
                rules_evaluated=[
                    {
                        "rule_id": "CORE_INSURANCE_RULE",
                        "source": "CORE",
                        "matched": True,
                    }
                ],
            )

        return self.no_match()