from pydantic import BaseModel, model_validator
from datetime import datetime
from typing import Any
import uuid


class RuleCondition(BaseModel):
    field: str
    operator: str
    value: float | str | int


class Rule(BaseModel):
    id: str
    # Multi-condition (canonical). Each entry is ANDed/ORed per `logic`.
    conditions: list[RuleCondition] = []
    # Single-condition (legacy — still accepted from old stored configs).
    condition: RuleCondition | None = None
    # "AND" = all conditions must match (default). "OR" = any condition must match.
    logic: str = "AND"
    action: str
    priority: int
    target: str | None = None
    description: str | None = None
    attributes: list[dict] = []

    @model_validator(mode="after")
    def migrate_single_condition(self) -> "Rule":
        """Transparently upgrade old single-condition rules to the conditions list."""
        if not self.conditions and self.condition is not None:
            self.conditions = [self.condition]
        return self


class RuleConfig(BaseModel):
    version: int
    rules: list[Rule]
    fallback: str


class RuleVersionCreate(BaseModel):
    config: RuleConfig


class RuleVersionResponse(BaseModel):
    id: uuid.UUID
    version_number: int
    config: dict[str, Any]
    tested_at: datetime | None
    test_result: dict[str, Any] | None
    applied_at: datetime | None
    applied_by: uuid.UUID | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TestParcel(BaseModel):
    weight_kg: float
    value_eur: float
    destination_country: str
    attributes: dict[str, Any] = {}


class RuleTestRequest(BaseModel):
    parcels: list[TestParcel]


class RuleTestResult(BaseModel):
    parcel: TestParcel
    decision: str
    rules_evaluated: list[dict[str, Any]]
