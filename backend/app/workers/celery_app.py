from celery import Celery
from pathlib import Path
import os

# Load .env from repo root so env vars are available when Celery reads os.environ
_env_path = Path(__file__).resolve().parents[3] / ".env"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())


def _broker_url() -> str:
    scheme = (
        "amqps" if os.environ.get("RABBITMQ_SSL", "false").lower() == "true" else "amqp"
    )
    user = os.environ.get("RABBITMQ_USER", "guest")
    password = os.environ.get("RABBITMQ_PASSWORD", "guest")
    host = os.environ.get("RABBITMQ_HOST", "rabbitmq")
    port = os.environ.get("RABBITMQ_PORT", "5672")
    vhost = os.environ.get("RABBITMQ_VHOST", "/").lstrip("/")
    return f"{scheme}://{user}:{password}@{host}:{port}/{vhost}"


def _backend_url() -> str:
    ssl = "?ssl=require" if os.environ.get("DB_SSL", "false").lower() == "true" else ""
    user = os.environ.get("DB_USER", "parcels")
    password = os.environ.get("DB_PASSWORD", "parcels")
    host = os.environ.get("DB_HOST", "postgres")
    port = os.environ.get("DB_PORT", "5432")
    name = os.environ.get("DB_NAME", "parcels")
    return f"db+postgresql://{user}:{password}@{host}:{port}/{name}{ssl}"


celery = Celery(
    "parcel_router",
    broker=_broker_url(),
    backend=_backend_url(),
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_queues={
        "routing.single": {"exchange": "routing", "routing_key": "single"},
        "routing.batch": {"exchange": "routing", "routing_key": "batch"},
        "routing.dlq": {"exchange": "routing", "routing_key": "dlq"},
    },
    task_default_queue="routing.single",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
)
