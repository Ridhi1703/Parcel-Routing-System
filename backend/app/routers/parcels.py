from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.parcel import Parcel
from app.models.routing_decision import RoutingDecision
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.parcel import ParcelSubmit, ParcelResponse, ParcelListResponse
from app.middleware.auth import require_role, get_current_user
from app.services.parcel_id import generate_parcel_id
from app.services.audit import write_audit
from app.workers.tasks import route_parcel
import uuid

router = APIRouter(prefix="/parcels", tags=["parcels"])


@router.post("/requeue", response_model=dict)
async def requeue_stuck_parcels(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("admin")),
):
    """Re-dispatch all parcels stuck in QUEUED status."""
    result = await db.execute(select(Parcel).where(Parcel.status == "QUEUED"))
    stuck = result.scalars().all()
    for parcel in stuck:
        route_parcel.apply_async(args=[parcel.id], queue="routing.single")
    return {"requeued": len(stuck)}


@router.post("", response_model=dict)
async def submit_parcel(
    body: ParcelSubmit,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("user", "admin")),
):
    parcel_id = await generate_parcel_id(db, body.destination_country)
    parcel = Parcel(
        id=parcel_id,
        weight_kg=body.weight_kg,
        value_eur=body.value_eur,
        destination_country=body.destination_country,
        attributes=body.attributes,
        status="QUEUED",
        submitted_by=uuid.UUID(user["sub"]),
    )
    db.add(parcel)
    await db.commit()

    await write_audit(db, "CREATED", uuid.UUID(user["sub"]), "parcel", parcel_id)

    # Queue routing task
    route_parcel.apply_async(args=[parcel_id], queue="routing.single")

    await write_audit(db, "QUEUED", None, "parcel", parcel_id, {"by": "system"})

    return {"parcel_id": parcel_id, "status": "QUEUED"}


@router.get("", response_model=ParcelListResponse)
async def list_parcels(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: str | None = None,
    country: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("user", "admin", "viewer")),
):
    query = (
        select(Parcel, RoutingDecision.decision, User.username)
        .outerjoin(RoutingDecision, RoutingDecision.parcel_id == Parcel.id)
        .outerjoin(User, User.id == Parcel.submitted_by)
    )

    # Users only see own parcels
    if user["role"] == "user":
        query = query.where(Parcel.submitted_by == uuid.UUID(user["sub"]))

    if status:
        query = query.where(Parcel.status == status)
    if country:
        query = query.where(Parcel.destination_country == country.upper())

    total_result = await db.execute(
        select(func.count()).select_from(
            select(Parcel)
            .where(
                *(
                    [Parcel.submitted_by == uuid.UUID(user["sub"])]
                    if user["role"] == "user"
                    else []
                ),
                *([Parcel.status == status] if status else []),
                *([Parcel.destination_country == country.upper()] if country else []),
            )
            .subquery()
        )
    )
    total = total_result.scalar() or 0

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

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/{parcel_id}")
async def get_parcel(
    parcel_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    parcel = await db.get(Parcel, parcel_id)
    if not parcel:
        raise HTTPException(404, "Parcel not found")

    if user["role"] == "user" and str(parcel.submitted_by) != user["sub"]:
        raise HTTPException(403, "Access denied")

    # Load routing decision
    rd_result = await db.execute(
        select(RoutingDecision).where(RoutingDecision.parcel_id == parcel_id)
    )
    routing_decision = rd_result.scalar_one_or_none()

    # Load audit trail
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == "parcel", AuditLog.entity_id == parcel_id)
        .order_by(AuditLog.occurred_at.asc())
    )
    audit_trail = audit_result.scalars().all()

    return {
        "parcel": ParcelResponse.model_validate(parcel),
        "routing_decision": {
            "rules_evaluated": routing_decision.rules_evaluated
            if routing_decision
            else [],
            "decision": routing_decision.decision if routing_decision else None,
            "reason": routing_decision.reason if routing_decision else None,
            "decided_at": routing_decision.decided_at if routing_decision else None,
        }
        if routing_decision
        else None,
        "audit_trail": [
            {
                "occurred_at": a.occurred_at,
                "action": a.action,
                "actor_id": str(a.actor_id) if a.actor_id else "system",
                "payload": a.payload,
            }
            for a in audit_trail
        ],
    }
