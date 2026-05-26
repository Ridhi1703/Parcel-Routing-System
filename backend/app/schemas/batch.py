from pydantic import BaseModel
from datetime import datetime
import uuid


class BatchJobResponse(BaseModel):
    id: uuid.UUID
    submitted_by: uuid.UUID | None
    total_count: int
    processed_count: int
    failed_count: int
    status: str
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class BatchUploadResponse(BaseModel):
    batch_job_id: uuid.UUID
    total_count: int
    errors: list[dict]
