# ParcelFlow

Production-grade parcel routing system. Three services: React frontend, FastAPI backend, Celery worker. Broker: RabbitMQ. DB: PostgreSQL.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, Zustand, TanStack Query, Recharts |
| Backend | FastAPI, SQLAlchemy (async), Alembic, JWT RS256 |
| Worker | Celery 5, RabbitMQ |
| DB | PostgreSQL 16 |
| Tooling | uv (Python), Docker Compose |

## Quick Start

```bash
# 1. Clone and install
git clone git@github.com:pratikwayal01/ParcelFlow.git
cd ParcelFlow
make install

# 2. Configure environment
make setup                        # copies .env.example → .env
# Edit .env: set JWT_SECRET_KEY=$(openssl rand -hex 32)

# 3. Start infra (postgres + rabbitmq in Docker)
make infra

# 4. Run migrations and seed
make migrate
make seed

# 5. Start app processes (each in a separate terminal)
make dev-backend      # FastAPI  → http://localhost:8000
make dev-worker       # Celery worker
make dev-frontend     # Vite     → http://localhost:5173
```

Services:
- API: http://127.0.0.1:8000
- UI: http://localhost:5173
- RabbitMQ management: http://localhost:15672

## Seed Credentials

| User | Password | Role |
|---|---|---|
| admin | admin123 | admin |
| viewer | viewer123 | viewer |
| jsmith | user123 | user |

## Key Features

- **Parcel IDs**: `PCL-{YYYYMMDD}-{COUNTRY}-{SEQ}` — human-readable, traceable
- **Rule engine**: config-driven chain of responsibility, admin-managed via UI
- **Rule versioning**: draft → test → apply flow; no silent overwrites; full diff view
- **Batch upload**: CSV drag-drop, per-row validation, live progress polling
- **3 roles**: User (submit), Admin (full control), Viewer (read-only)
- **Dead letter queue**: retry/dismiss per-item or bulk
- **Audit trail**: every parcel state change logged, visible on detail page

## Project Structure

```
ParcelFlow/
├── backend/
│   ├── app/
│   │   ├── models/       # SQLAlchemy ORM
│   │   ├── routers/      # FastAPI endpoints
│   │   ├── schemas/      # Pydantic models
│   │   ├── services/     # rule engine, parcel ID, audit
│   │   └── workers/      # Celery tasks
│   ├── alembic/          # migrations
│   └── tests/
├── frontend/
│   └── src/
│       ├── pages/        # user/ admin/ viewer/
│       ├── components/   # layout/ ui/ parcels/
│       ├── stores/       # Zustand (auth, notifications)
│       └── api/          # axios client + per-resource modules
├── docker-compose.yml  # infra only (postgres + rabbitmq)
├── Makefile
└── .env.example
```

## High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Browser                                  │
│   React 18 + Vite                                                   │
│   ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
│   │  Submit  │  │ Rule Editor  │  │ My Parcel│  │Batch Upload  │   │
│   │  Parcel  │  │ (draft/apply)│  │  + filter│  │ CSV drag-drop│   │
│   └────┬─────┘  └──────┬───────┘  └────┬─────┘  └──────┬───────┘   │
│        │               │               │               │           │
│        └───────────────┴───────────────┴───────────────┘           │
│                         TanStack Query (HTTP)                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ REST / JSON  (JWT Bearer)
┌───────────────────────────────▼─────────────────────────────────────┐
│                        FastAPI Backend                               │
│                                                                     │
│  /auth      /parcels    /parcels/batch   /admin/*   /rules/*        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Rule Engine  (services/rule_engine.py)                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │   │
│  │  │ Rule 1   │→ │ Rule 2   │→ │ Rule N   │→ │  Fallback   │  │   │
│  │  │ priority │  │ AND/OR   │  │ multi-   │  │ DEAD_LETTER │  │   │
│  │  │ cond(s)  │  │ cond(s)  │  │ cond(s)  │  │             │  │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Async SQLAlchemy  ──────────────────────────────┐                  │
│  Alembic migrations                              │                  │
└──────────────────────────────────────────────────┼──────────────────┘
                                                   │ SQL
┌──────────────────────────────────────────────────▼──────────────────┐
│                      PostgreSQL 16                                   │
│  users  parcels  batch_jobs  rule_versions  routing_decisions       │
│  audit_logs  dead_letter_items                                       │
└──────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Async Message Flow                               │
│                                                                     │
│  POST /parcels  ──► Parcel row (QUEUED) ──► process_parcel.delay()  │
│  POST /parcels/batch ► N parcel rows   ──► process_batch.delay()    │
│                                                    │                │
│                              RabbitMQ              │                │
│                         ┌──────────────┐           │                │
│                         │routing.tasks │◄──────────┘                │
│                         │routing.batch │                            │
│                         └──────┬───────┘                            │
│                                │                                    │
│                    ┌───────────▼────────────┐                       │
│                    │   Celery Worker         │                       │
│                    │  evaluate_rules()       │                       │
│                    │  → status: ROUTED /     │                       │
│                    │    INSURANCE_HOLD /     │                       │
│                    │    FAILED / DEAD_LETTER │                       │
│                    │  write routing_decision │                       │
│                    │  write audit_log        │                       │
│                    └─────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────┘

Rule Versioning Flow:
  [Edit rules in UI] → Save Draft → Test Sandbox → Apply
        │                   │              │           │
    in-memory           rule_version    testRule()  rule_version
    (no DB write)       (is_active=F)   endpoint    (is_active=T,
                                                     prev superseded)

Role Matrix:
  admin  → full access (parcels, rules, users, batch, dead-letter, dashboard)
  user   → submit parcels, batch upload, view own parcels
  viewer → read-only dashboard + parcels list
```

## Tests

```bash
make test       # pytest (rule engine + auth unit tests)
make test-cov   # with coverage report
```
