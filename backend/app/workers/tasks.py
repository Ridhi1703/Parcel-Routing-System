from __future__ import annotations

import uuid
from datetime import datetime, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, update as sql_update, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings
from app.workers.celery_app import celery

logger = get_task_logger(__name__)

_sync_engine = None
_SyncSession = None


def _get_sync_db() -> Session:
    global _sync_engine, _SyncSession

    if _sync_engine is None:
        _sync_engine = create_engine(
            get_settings().sync_database_url
        )

        _SyncSession = sessionmaker(
            _sync_engine
        )

    return _SyncSession()


def _increment_batch_progress(
    db: Session,
    batch_job_id: str,
    failed: bool = False,
) -> None:
    """
    Atomically increment batch counters
    and complete batch when done.
    """

    from app.models.batch_job import BatchJob

    bid = uuid.UUID(batch_job_id)

    values: dict = {
        BatchJob.processed_count:
            BatchJob.processed_count + 1
    }

    if failed:

        values[BatchJob.failed_count] = (
            BatchJob.failed_count + 1
        )

    db.execute(
        sql_update(BatchJob)
        .where(BatchJob.id == bid)
        .values(values)
    )

    db.flush()

    job = db.get(BatchJob, bid)

    if (
        job
        and job.processed_count >= job.total_count
        and job.status == "PROCESSING"
    ):
        job.status = "COMPLETED"


@celery.task(
    bind=True,
    max_retries=3,
    default_retry_delay=10,
    queue="routing.single",
)
def route_parcel(
    self,
    parcel_id: str,
    batch_job_id: str | None = None,
) -> dict:

    from app.models.parcel import Parcel
    from app.models.rule_version import RuleVersion
    from app.models.routing_decision import RoutingDecision
    from app.models.audit_log import AuditLog

    from app.schemas.rule import RuleConfig
    from app.services.rules.engine import HybridRuleEngine

    db = _get_sync_db()

    try:

        # 1. Load parcel
        parcel = db.get(
            Parcel,
            parcel_id,
        )

        if not parcel:
            raise ValueError(
                f"Parcel {parcel_id} not found"
            )

        # 2. Load active rule version
        rv = db.execute(
            select(RuleVersion).where(
                RuleVersion.is_active == True
            )
        ).scalar_one_or_none()

        if not rv:
            raise ValueError(
                "No active rule version found"
            )

        dynamic_config = RuleConfig.model_validate(
            rv.config
        )

        # 3. Build parcel payload
        parcel_dict = {
            "weight_kg": float(parcel.weight_kg),
            "value_eur": float(parcel.value_eur),
            "destination_country":
                parcel.destination_country,
            "attributes":
                parcel.attributes or {},
        }

        # 4. Execute engine
        engine = HybridRuleEngine(
            dynamic_config=dynamic_config
        )

        result = engine.evaluate(
            parcel_dict
        )

        # 5. Save routing decision
        routing_decision = RoutingDecision(
            parcel_id=parcel_id,
            decision=result.decision,
            rules_evaluated=(
                result.rules_evaluated
            ),
            reason=(
                f"Matched rule chain "
                f"→ {result.decision}"
            ),
        )

        db.add(routing_decision)

       # 6. Dynamic status handling

       # ROUTE_TO decisions should remain ROUTED
        if result.decision.endswith("Department"):

           new_status = "ROUTED"

# Terminal/custom actions
        else:

           new_status = (
           result.decision.upper()
           .replace(" ", "_")
           )    

        

        fallback_value = (
            dynamic_config.fallback
            if hasattr(
                dynamic_config,
                "fallback",
            )
            else "DEAD_LETTER"
        )

        if result.decision == fallback_value:

            new_status = "DEAD_LETTER"

        # 7. Update parcel
        parcel.status = new_status

        parcel.updated_at = datetime.now(
            timezone.utc
        )

        # 8. Audit log
        audit = AuditLog(
            action="ROUTED",
            entity_type="parcel",
            entity_id=parcel_id,
            payload={
                "decision":
                    result.decision,

                "status":
                    new_status,

                "matched_rules":
                    result.matched_rules,

                "reasons":
                    result.reasons,
            },
        )

        db.add(audit)

        # 9. Batch progress
        if batch_job_id:

            _increment_batch_progress(
                db,
                batch_job_id,
                failed=(
                    new_status
                    == "DEAD_LETTER"
                ),
            )

        db.commit()

        logger.info(
            f"Parcel {parcel_id} "
            f"routed successfully "
            f"→ {result.decision}"
        )

        return {
            "parcel_id": parcel_id,
            "decision": result.decision,
            "status": new_status,
        }

    except Exception as exc:

        db.rollback()

        logger.error(
            f"route_parcel failed "
            f"for {parcel_id}: {exc}"
        )

        try:

            raise self.retry(exc=exc)

        except self.MaxRetriesExceededError:

            failed_parcel = db.get(
                Parcel,
                parcel_id,
            )

            if failed_parcel:

                failed_parcel.status = (
                    "DEAD_LETTER"
                )

            if batch_job_id:

                _increment_batch_progress(
                    db,
                    batch_job_id,
                    failed=True,
                )

            db.commit()

            raise

    finally:

        db.close()


@celery.task(
    bind=True,
    queue="routing.batch",
)
def process_batch(
    self,
    batch_job_id: str,
) -> dict:

    from app.models.batch_job import BatchJob
    from app.models.parcel import Parcel

    db = _get_sync_db()

    try:

        job = db.get(
            BatchJob,
            uuid.UUID(batch_job_id),
        )

        if not job:
            raise ValueError(
                f"BatchJob "
                f"{batch_job_id} not found"
            )

        parcels = (
            db.execute(
                select(Parcel).where(
                    Parcel.batch_id
                    == uuid.UUID(batch_job_id)
                )
            )
            .scalars()
            .all()
        )

        for parcel in parcels:

            route_parcel.apply_async(
                args=[parcel.id],
                kwargs={
                    "batch_job_id":
                        batch_job_id
                },
                queue="routing.single",
            )

        return {
            "batch_job_id":
                batch_job_id,

            "dispatched":
                len(parcels),
        }

    finally:

        db.close()