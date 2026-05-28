from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.rule_version import RuleVersion

from app.schemas.rule import (
    RuleVersionCreate,
    RuleVersionResponse,
    RuleTestRequest,
    RuleTestResult,
    RuleConfig,
)

from app.middleware.auth import require_role

from app.services.rule_engine import validate_rule_config
from app.services.rules.engine import HybridRuleEngine


import uuid

router = APIRouter(
    prefix="/rules",
    tags=["rules"],
)


@router.get(
    "",
    response_model=list[RuleVersionResponse],
)
async def list_rules(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin", "viewer")
    ),
):

    result = await db.execute(
        select(RuleVersion).order_by(
            RuleVersion.version_number.desc()
        )
    )

    return result.scalars().all()


@router.get(
    "/active",
    response_model=RuleVersionResponse,
)
async def get_active_rule(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin", "viewer")
    ),
):

    result = await db.execute(
        select(RuleVersion).where(
            RuleVersion.is_active == True
        )
    )  # noqa: E712

    rv = result.scalar_one_or_none()

    if not rv:
        raise HTTPException(
            404,
            "No active rule version",
        )

    return rv


@router.post(
    "/draft",
    response_model=RuleVersionResponse,
)
async def create_draft(
    body: RuleVersionCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin")
    ),
):

    # SHIFT PRIORITIES
    sorted_rules = sorted(
        body.config.rules,
        key=lambda r: r.priority,
    )

    used_priorities = set()

    for rule in sorted_rules:

        original_priority = rule.priority

        while rule.priority in used_priorities:
            rule.priority += 1

        used_priorities.add(rule.priority)

    body.config.rules = sorted(
        sorted_rules,
        key=lambda r: r.priority,
    )

    # Next version number
    result = await db.execute(
        select(RuleVersion)
        .order_by(
            RuleVersion.version_number.desc()
        )
        .limit(1)
    )

    latest = result.scalar_one_or_none()

    next_version = (
        latest.version_number + 1
        if latest
        else 1
    )

    rv = RuleVersion(
        version_number=next_version,
        config=body.config.model_dump(),
    )

    db.add(rv)

    await db.commit()
    await db.refresh(rv)

    return rv


@router.post("/{rule_id}/test")
async def test_rule(
    rule_id: uuid.UUID,
    body: RuleTestRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin")
    ),
):

    rv = await db.get(
        RuleVersion,
        rule_id,
    )

    if not rv:
        raise HTTPException(
            404,
            "Rule version not found",
        )

    config = RuleConfig.model_validate(
        rv.config
    )

    engine = HybridRuleEngine(
        dynamic_config=config
    )

    results = []

    for tp in body.parcels:

        parcel_dict = {
            "weight_kg": float(tp.weight_kg),
            "value_eur": float(tp.value_eur),
            "destination_country": tp.destination_country,
            "attributes": tp.attributes or {},
        }

        result = engine.evaluate(parcel_dict)

        results.append(
            {
                "parcel": tp.model_dump(),
                "decision": result.decision,
                "rules_evaluated": result.rules_evaluated,
                "matched_rules": result.matched_rules,
                "reasons": result.reasons,
            }
        )

    rv.tested_at = datetime.now(
        timezone.utc
    )

    rv.test_result = {
        "results": results,
        "total": len(results),
    }

    await db.commit()

    return {
        "rule_version_id": str(rule_id),
        "results": results,
    }


@router.put(
    "/{rule_id}/apply",
    response_model=RuleVersionResponse,
)
async def apply_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin")
    ),
):

    rv = await db.get(
        RuleVersion,
        rule_id,
    )

    if not rv:
        raise HTTPException(
            404,
            "Rule version not found",
        )

    if not rv.tested_at:
        raise HTTPException(
            400,
            "Rule version must be tested before applying",
        )

    config = RuleConfig.model_validate(
        rv.config
    )

    errors = validate_rule_config(config)

    if errors:
        raise HTTPException(
            400,
            detail={"errors": errors},
        )

    # Deactivate previous active rules
    all_result = await db.execute(
        select(RuleVersion).where(
            RuleVersion.is_active == True
        )
    )  # noqa: E712

    for old in all_result.scalars().all():
        old.is_active = False

    rv.is_active = True
    rv.applied_at = datetime.now(
        timezone.utc
    )

    rv.applied_by = uuid.UUID(
        user["sub"]
    )

    await db.commit()
    await db.refresh(rv)

    return rv


@router.delete(
    "/{rule_id}",
    status_code=204,
)
async def delete_draft(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin")
    ),
):

    rv = await db.get(
        RuleVersion,
        rule_id,
    )

    if not rv:
        raise HTTPException(
            404,
            "Rule version not found",
        )

    if rv.is_active:
        raise HTTPException(
            400,
            "Cannot delete the active rule version",
        )

    await db.delete(rv)

    await db.commit()


@router.get("/{rule_id}/diff")
async def diff_rules(
    rule_id: uuid.UUID,
    compare_to: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(
        require_role("admin")
    ),
):

    rv_a = await db.get(
        RuleVersion,
        rule_id,
    )

    rv_b = await db.get(
        RuleVersion,
        compare_to,
    )

    if not rv_a or not rv_b:
        raise HTTPException(
            404,
            "One or both rule versions not found",
        )

    return {
        "version_a": rv_a.config,
        "version_b": rv_b.config,
    }