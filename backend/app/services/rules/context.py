from dataclasses import dataclass, field


@dataclass
class RoutingContext:
    decision: str | None = None
    insurance_required: bool = False
    requires_special_handling: bool = False

    reasons: list[str] = field(default_factory=list)
    matched_rules: list[str] = field(default_factory=list)
    rules_evaluated: list[dict] = field(default_factory=list)

    def apply(self, result):
        if not result.matched:
            return

        for key, value in result.updates.items():
            setattr(self, key, value)

        self.reasons.extend(result.reasons)
        self.matched_rules.extend(result.matched_rules)
        self.rules_evaluated.extend(result.rules_evaluated)