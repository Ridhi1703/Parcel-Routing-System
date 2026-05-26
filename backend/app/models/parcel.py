import uuid
from sqlalchemy import String, Numeric, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    weight_kg: Mapped[float] = mapped_column(Numeric(10, 3), nullable=False)
    value_eur: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    destination_country: Mapped[str] = mapped_column(String(2), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")
    submitted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
