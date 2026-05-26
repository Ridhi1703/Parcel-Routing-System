from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog
import uuid


async def write_audit(
    db: AsyncSession,
    action: str,
    actor_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    payload: dict | None = None,
) -> None:
    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(entry)
    await db.commit()
