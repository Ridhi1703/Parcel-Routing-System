from abc import ABC, abstractmethod
from app.services.rules.contracts import RuleResult


class BaseRule(ABC):

    priority: int = 100     
    sets_decision: bool = False  

    @abstractmethod
    def evaluate(self, parcel: dict) -> RuleResult:
        pass

    def no_match(self) -> RuleResult:
        return RuleResult(matched=False)

    def match(
        self,
        updates: dict,
        reasons: list[str],
        matched_rules: list[str],
        rules_evaluated: list[dict],
    ) -> RuleResult:
        return RuleResult(
            matched=True,
            updates=updates,
            reasons=reasons,
            matched_rules=matched_rules,
            rules_evaluated=rules_evaluated,
        )