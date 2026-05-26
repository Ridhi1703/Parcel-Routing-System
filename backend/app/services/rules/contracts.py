from dataclasses import dataclass, field
from typing import Any


@dataclass
class RuleResult:
    matched: bool
    updates: dict[str, Any] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)
    matched_rules: list[str] = field(default_factory=list)
    rules_evaluated: list[dict[str, Any]] = field(default_factory=list)