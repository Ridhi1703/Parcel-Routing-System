import uuid
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class RoutingDecision(Base):
    __tablename__ = "routing_decisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    parcel_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("parcels.id"), nullable=False
    )
    rules_evaluated: Mapped[list] = mapped_column(JSONB, nullable=False)
    decision: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
