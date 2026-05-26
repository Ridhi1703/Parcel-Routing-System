from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.database import get_db
from app.models.parcel import Parcel
from app.models.audit_log import AuditLog
from app.models.batch_job import BatchJob
from app.models.routing_decision import RoutingDecision
from app.models.user import User
from app.schemas.parcel import ParcelResponse
from app.middleware.auth import require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def summary(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin", "viewer")),
):
    statuses = [
        "PENDING",
        "QUEUED",
        "ROUTED",
        "INSURANCE_HOLD",
        "FAILED",
        "DEAD_LETTER",
    ]
    counts = {}
    for s in statuses:
        r = await db.execute(select(func.count()).where(Parcel.status == s))
        counts[s] = r.scalar() or 0

    total = await db.execute(select(func.count(Parcel.id)))
    return {"total": total.scalar() or 0, **counts}


@router.get("/parcels")
async def all_parcels(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str | None = None,
    country: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin", "viewer")),
):
    query = (
        select(Parcel, RoutingDecision.decision, User.username)
        .outerjoin(RoutingDecision, RoutingDecision.parcel_id == Parcel.id)
        .outerjoin(User, User.id == Parcel.submitted_by)
    )
    if status:
        query = query.where(Parcel.status == status)
    if country:
        query = query.where(Parcel.destination_country == country.upper())

    total_r = await db.execute(
        select(func.count()).select_from(
            select(Parcel)
            .where(
                *([Parcel.status == status] if status else []),
                *([Parcel.destination_country == country.upper()] if country else []),
            )
            .subquery()
        )
    )
    total = total_r.scalar() or 0

    query = (
        query.order_by(Parcel.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    rows = result.all()

    items = []
    for parcel, decision, username in rows:
        pr = ParcelResponse.model_validate(parcel)
        pr.routing_decision = decision
        pr.submitted_by_username = username
        items.append(pr)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/audit")
async def audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    total_r = await db.execute(select(func.count(AuditLog.id)))
    total = total_r.scalar() or 0

    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.occurred_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return {
        "items": [
            {
                "id": a.id,
                "actor_id": str(a.actor_id) if a.actor_id else None,
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_id": a.entity_id,
                "payload": a.payload,
                "occurred_at": a.occurred_at,
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/batch/{batch_id}")
async def batch_progress(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin", "viewer", "user")),
):
    job = await db.get(BatchJob, batch_id)
    if not job:
        return {"error": "Batch job not found"}
    return {
        "id": str(job.id),
        "total_count": job.total_count,
        "processed_count": job.processed_count,
        "failed_count": job.failed_count,
        "status": job.status,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
    }


@router.get("/dlq")
async def dead_letter_queue(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    result = await db.execute(
        select(Parcel, RoutingDecision.decision, User.username)
        .outerjoin(RoutingDecision, RoutingDecision.parcel_id == Parcel.id)
        .outerjoin(User, User.id == Parcel.submitted_by)
        .where(Parcel.status == "DEAD_LETTER")
        .order_by(Parcel.updated_at.desc())
    )
    rows = result.all()
    items = []
    for parcel, decision, username in rows:
        pr = ParcelResponse.model_validate(parcel)
        pr.routing_decision = decision
        pr.submitted_by_username = username
        items.append(pr)
    return {
        "items": items,
        "total": len(items),
    }
