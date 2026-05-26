import csv
import io
import uuid

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.parcel import Parcel
from app.models.batch_job import BatchJob
from app.schemas.batch import BatchJobResponse, BatchUploadResponse
from app.middleware.auth import require_role
from app.services.parcel_id import generate_parcel_id
from app.workers.tasks import process_batch

router = APIRouter(prefix="/parcels", tags=["batch"])

REQUIRED_FIELDS = {"weight_kg", "value_inr", "destination_country"}


@router.post("/batch", response_model=BatchUploadResponse)
async def upload_batch(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("user", "admin")),
):
    content = await file.read()
    text = content.decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))

    errors = []
    valid_rows = []
    batch_id = uuid.uuid4()

    for i, row in enumerate(reader, start=2):  # row 1 is header
        missing = REQUIRED_FIELDS - set(row.keys())
        if missing:
            errors.append({"row": i, "error": f"missing fields: {', '.join(missing)}"})
            continue

        try:
            weight_kg = float(row["weight_kg"])
            value_inr = float(row["value_inr"])
            country = row["destination_country"].strip().upper()

            if weight_kg <= 0:
                raise ValueError("weight_kg must be > 0")
            if value_inr < 0:
                raise ValueError("value_inr must be >= 0")
            if len(country) != 2:
                raise ValueError("destination_country must be 2-letter ISO code")

            # Collect custom attributes from attr_* columns
            attributes: dict = {}
            if row.get("reference"):
                attributes["reference"] = row["reference"].strip()
            for key, val in row.items():
                if key.startswith("attr_") and val and val.strip():
                    attr_name = key[5:]  # strip "attr_" prefix
                    attributes[attr_name] = val.strip()

            valid_rows.append(
                {
                    "weight_kg": weight_kg,
                    "value_eur": value_inr,
                    "destination_country": country,
                    "attributes": attributes,
                }
            )
        except (ValueError, KeyError) as e:
            errors.append({"row": i, "error": str(e)})

    if not valid_rows:
        raise HTTPException(
            400, detail={"message": "No valid rows found", "errors": errors}
        )

    # Create batch job
    job = BatchJob(
        id=batch_id,
        submitted_by=uuid.UUID(user["sub"]),
        total_count=len(valid_rows),
    )
    db.add(job)
    await db.flush()

    # Create parcels
    for row_data in valid_rows:
        parcel_id = await generate_parcel_id(db, row_data["destination_country"])
        parcel = Parcel(
            id=parcel_id,
            weight_kg=row_data["weight_kg"],
            value_eur=row_data["value_eur"],
            destination_country=row_data["destination_country"],
            attributes=row_data["attributes"],
            status="QUEUED",
            submitted_by=uuid.UUID(user["sub"]),
            batch_id=batch_id,
        )
        db.add(parcel)

    await db.commit()

    # Dispatch batch task
    process_batch.apply_async(args=[str(batch_id)], queue="routing.batch")

    return BatchUploadResponse(
        batch_job_id=batch_id,
        total_count=len(valid_rows),
        errors=errors,
    )
