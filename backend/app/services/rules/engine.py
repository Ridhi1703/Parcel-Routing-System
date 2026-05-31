import logging

from app.services.rules.context import RoutingContext
from app.services.rules.core.insurance_rule import InsuranceRule
from app.services.rules.core.mail_rule import MailRule
from app.services.rules.core.regular_rule import RegularRule
from app.services.rules.core.heavy_rule import HeavyRule
from app.services.rules.core.fragile_rule import FragileRule
from app.services.rules.dynamic.executor import DynamicRuleExecutor

logger = logging.getLogger(__name__)


class HybridRuleEngine:

    def __init__(self, dynamic_config=None):

        all_core = [
            InsuranceRule(),  # priority 1
            MailRule(),       # priority 2
            RegularRule(),    # priority 3
            HeavyRule()      # priority 4
           
        ]

        # Routing rules: set decision, first match wins
        self.routing_rules = sorted(
            [r for r in all_core if r.sets_decision],
            key=lambda r: r.priority,
        )

        # Flag rules: orthogonal, always ALL run
        self.flag_rules = sorted(
            [r for r in all_core if not r.sets_decision],
            key=lambda r: r.priority,
        )

        self.dynamic_executor = (
            DynamicRuleExecutor(dynamic_config)
            if dynamic_config
            else None
        )

    def evaluate(self, parcel: dict) -> RoutingContext:

        context = RoutingContext()

        # ── Routing rules: priority order, first match wins ──
        for rule in self.routing_rules:
            result = rule.evaluate(parcel)
            context.apply(result)
            if context.decision:
                logger.debug(
                    "Core routing: %s matched → %s",
                    rule.__class__.__name__,
                    context.decision,
                )
                break                    

        # ── Flag rules: always all run ──
        for rule in self.flag_rules:
            result = rule.evaluate(parcel)
            context.apply(result)
            logger.debug(
                "Core flag: %s → matched=%s",
                rule.__class__.__name__,
                result.matched,
            )

        # ── Dynamic rules: priority order, first match wins ──
        if self.dynamic_executor:
            dynamic_result = self.dynamic_executor.evaluate(parcel)
            context.apply(dynamic_result)

        # ── Fallback ──
        if not context.decision:
            context.decision = "DEAD_LETTER"
            logger.warning(
                "DEAD_LETTER — no rule matched. parcel=%s",
                parcel.get("id"),
            )

        return context