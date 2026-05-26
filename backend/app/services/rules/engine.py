from app.services.rules.context import RoutingContext

from app.services.rules.core.weight_rule import WeightRule
from app.services.rules.core.insurance_rule import InsuranceRule
from app.services.rules.core.fragile_rule import FragileRule

from app.services.rules.dynamic.executor import DynamicRuleExecutor


class HybridRuleEngine:

    def __init__(self, dynamic_config=None):

        self.core_rules = [
            WeightRule(),
            InsuranceRule(),
            FragileRule(),
        ]

        self.dynamic_executor = (
            DynamicRuleExecutor(dynamic_config)
            if dynamic_config
            else None
        )

    def evaluate(self, parcel: dict) -> RoutingContext:

        context = RoutingContext()

        # Core rules first
        for rule in self.core_rules:
            result = rule.evaluate(parcel)
            context.apply(result)

        # Dynamic rules second
        if self.dynamic_executor:
            dynamic_result = self.dynamic_executor.evaluate(parcel)
            context.apply(dynamic_result)

        # Final fallback
        if not context.decision:
            context.decision = "DEAD_LETTER"

        return context