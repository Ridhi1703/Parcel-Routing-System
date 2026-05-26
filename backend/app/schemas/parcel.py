from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Any
import uuid


class ParcelSubmit(BaseModel):
    weight_kg: float
    value_eur: float
    destination_country: str
    attributes: dict[str, Any] = {}

    @field_validator("weight_kg")
    @classmethod
    def weight_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("weight_kg must be > 0")
        return v

    @field_validator("value_eur")
    @classmethod
    def value_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("value_eur must be >= 0")
        return v

    @field_validator("destination_country")
    @classmethod
    def country_2char(cls, v: str) -> str:
        if len(v) != 2:
            raise ValueError("destination_country must be ISO 3166-1 alpha-2")
        return v.upper()


class ParcelResponse(BaseModel):
    id: str
    weight_kg: float
    value_eur: float
    destination_country: str
    attributes: dict[str, Any]
    status: str
    submitted_by: uuid.UUID | None
    batch_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    routing_decision: str | None = None  # matched rule / department
    submitted_by_username: str | None = None

    model_config = {"from_attributes": True}


class ParcelListResponse(BaseModel):
    items: list[ParcelResponse]
    total: int
    page: int
    page_size: int
