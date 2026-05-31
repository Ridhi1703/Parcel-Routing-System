from app.services.rules.base import BaseRule


class MailRule(BaseRule):

    priority = 2              # ← UI priority 2
    sets_decision = True

    def evaluate(self, parcel: dict):

        if float(parcel["weight_kg"]) <= 1:
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
        return self.no_match()