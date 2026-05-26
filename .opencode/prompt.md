# Full Build Prompt: Parcel Routing System

---

## Project Overview

Build a production-grade **Parcel Routing System** composed of three independently deployable services:

1. **React Frontend** — role-based UI for Users, Admins, and Viewers
2. **FastAPI Backend** — REST API, auth, rule management, task dispatch
3. **Celery Worker** — async parcel routing processor

Broker: **RabbitMQ**. Database: **PostgreSQL**. All services containerised with Docker Compose.

**Python tooling: use `uv` exclusively — no pip, no virtualenv, no poetry.**

---

## Part 1: Database Schema (PostgreSQL)

### Tables

```sql
-- Users and auth
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parcels
CREATE TABLE parcels (
  id VARCHAR(32) PRIMARY KEY,           -- e.g. PCL-20260524-NL-00042
  weight_kg NUMERIC(10, 3) NOT NULL,
  value_eur NUMERIC(12, 2) NOT NULL,
  destination_country CHAR(2) NOT NULL, -- ISO 3166-1 alpha-2
  attributes JSONB DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'QUEUED', 'INSURANCE_HOLD', 'ROUTED', 'FAILED', 'DEAD_LETTER')),
  submitted_by UUID REFERENCES users(id),
  batch_id UUID,                        -- null if single upload
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing decisions (one per parcel, append-only)
CREATE TABLE routing_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id VARCHAR(32) REFERENCES parcels(id),
  rules_evaluated JSONB NOT NULL,       -- ordered list of rules checked
  decision VARCHAR(64) NOT NULL,        -- department name or INSURANCE_HOLD
  reason TEXT,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log (immutable)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id),
  action VARCHAR(128) NOT NULL,
  entity_type VARCHAR(64),
  entity_id TEXT,
  payload JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing rule versions (never overwrite, always append)
CREATE TABLE rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number INT NOT NULL,
  config JSONB NOT NULL,                -- full rule chain as JSON
  tested_at TIMESTAMPTZ,
  test_result JSONB,                    -- dry-run result summary
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch upload jobs
CREATE TABLE batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES users(id),
  total_count INT NOT NULL,
  processed_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  status VARCHAR(32) DEFAULT 'PROCESSING'
    CHECK (status IN ('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Parcel ID Format

```
PCL-{YYYYMMDD}-{ISO_COUNTRY}-{SEQUENCE_5_DIGITS}
Example: PCL-20260524-NL-00042
```

Generated server-side using: date + country code + daily auto-incrementing sequence padded to 5 digits. This makes IDs human-readable, sortable, and traceable to origin.

---

## Part 2: Backend — FastAPI

### Project Structure

```
backend/
├── app/
│   ├── main.py
│   ├── config.py                  # pydantic-settings, env vars
│   ├── database.py                # async SQLAlchemy engine
│   ├── models/                    # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── parcel.py
│   │   ├── rule_version.py
│   │   ├── routing_decision.py
│   │   ├── audit_log.py
│   │   └── batch_job.py
│   ├── schemas/                   # Pydantic request/response models
│   │   ├── parcel.py
│   │   ├── rule.py
│   │   ├── user.py
│   │   └── batch.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── parcels.py
│   │   ├── rules.py
│   │   ├── dashboard.py
│   │   └── batch.py
│   ├── services/
│   │   ├── parcel_id.py           # ID generation logic
│   │   ├── rule_engine.py         # dry-run + validate rule chain
│   │   └── audit.py              # audit log writer
│   ├── workers/
│   │   ├── celery_app.py          # Celery + RabbitMQ config
│   │   └── tasks.py              # route_parcel, process_batch
│   └── middleware/
│       └── auth.py               # JWT decode, role guard
├── alembic/                       # migrations
├── tests/
├── Dockerfile
├── pyproject.toml                 # project metadata + dependencies (uv)
└── uv.lock                        # lockfile committed to version control
```

### Auth

- JWT (RS256), issued on login, 8-hour expiry
- Refresh token stored in HttpOnly cookie
- Role stored in JWT payload: `"role": "admin" | "user" | "viewer"`
- Route guards via FastAPI dependency injection:

```python
def require_role(*roles):
    def dependency(token: str = Depends(oauth2_scheme)):
        payload = decode_jwt(token)
        if payload["role"] not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return payload
    return dependency
```

### API Endpoints

#### Auth
```
POST /auth/login          → { access_token, token_type }
POST /auth/refresh        → refreshed access_token
POST /auth/logout
```

#### Parcels (User + Admin)
```
POST /parcels             → submit single parcel → queues task → returns parcel_id immediately
POST /parcels/batch       → upload CSV → creates batch_job → queues batch task
GET  /parcels             → list parcels (paginated, filterable by status/country/date)
GET  /parcels/{id}        → parcel detail + routing decision + audit trail
```

#### Rules (Admin only)
```
GET  /rules               → list all rule versions
GET  /rules/active        → current active rule chain
POST /rules/draft         → save a new draft rule version
POST /rules/{id}/test     → dry-run against sample parcels → returns decision preview
PUT  /rules/{id}/apply    → promote to active (validates config first)
GET  /rules/{id}/diff     → compare two versions
```

#### Dashboard (Admin + Viewer)
```
GET  /dashboard/summary   → counts by status, department, country
GET  /dashboard/parcels   → full parcel list with filters
GET  /dashboard/audit     → audit log (paginated)
GET  /dashboard/batch/{id} → batch job progress
GET  /dashboard/dlq       → dead letter queue items
```

### Rule Config Format (stored in rule_versions.config)

```json
{
  "version": 2,
  "rules": [
    {
      "id": "insurance-gate",
      "type": "value_threshold",
      "condition": { "field": "value_eur", "operator": "gt", "value": 1000 },
      "action": "INSURANCE_HOLD",
      "priority": 1,
      "description": "Parcels over €1,000 require insurance approval"
    },
    {
      "id": "mail-dept",
      "type": "weight_range",
      "condition": { "field": "weight_kg", "operator": "lte", "value": 1 },
      "action": "ROUTE_TO",
      "target": "Mail Department",
      "priority": 2
    },
    {
      "id": "regular-dept",
      "type": "weight_range",
      "condition": { "field": "weight_kg", "operator": "lte", "value": 10 },
      "action": "ROUTE_TO",
      "target": "Regular Department",
      "priority": 3
    },
    {
      "id": "heavy-dept",
      "type": "weight_range",
      "condition": { "field": "weight_kg", "operator": "gt", "value": 10 },
      "action": "ROUTE_TO",
      "target": "Heavy Department",
      "priority": 4
    }
  ],
  "fallback": "DEAD_LETTER"
}
```

**Rule validation on apply:**
- Must have exactly one fallback
- No priority conflicts
- All `ROUTE_TO` targets must be known departments
- No gap in weight ranges (warn if overlap or gap detected)
- If validation fails → reject with detailed error, do NOT apply

### Celery Worker Tasks

```python
# workers/tasks.py

@celery.task(bind=True, max_retries=3, default_retry_delay=10)
def route_parcel(self, parcel_id: str):
    """
    1. Load parcel from DB
    2. Load active rule version
    3. Evaluate rule chain in priority order
    4. Write routing_decision row
    5. Update parcel.status
    6. Write audit_log entry
    7. On exception: retry up to 3 times, then push to DLQ
    """

@celery.task(bind=True)
def process_batch(self, batch_job_id: str):
    """
    1. Load all parcels for this batch_job_id
    2. Dispatch individual route_parcel tasks for each
    3. Update batch_job.processed_count as tasks complete
    4. Set batch_job.status = COMPLETED | PARTIAL | FAILED
    """
```

### RabbitMQ Queues

```
routing.single    → individual parcel tasks (higher priority)
routing.batch     → batch processing tasks
routing.dlq       → failed tasks after max retries
```

---

## Part 3: Celery + RabbitMQ Configuration

```python
# workers/celery_app.py
from celery import Celery

celery = Celery(
    "parcel_router",
    broker="amqp://guest:guest@rabbitmq:5672//",
    backend="db+postgresql://...",
    include=["app.workers.tasks"]
)

celery.conf.update(
    task_queues={
        "routing.single": {"exchange": "routing", "routing_key": "single"},
        "routing.batch": {"exchange": "routing", "routing_key": "batch"},
        "routing.dlq": {"exchange": "routing", "routing_key": "dlq"},
    },
    task_default_queue="routing.single",
    task_acks_late=True,              # ack only after task completes
    task_reject_on_worker_lost=True,  # requeue if worker dies mid-task
    worker_prefetch_multiplier=1,     # fair dispatch
)
```

---

## Part 4: CSV Batch Upload Format

Use **CSV** (not JSON) for batch upload. Justification: operations staff typically prepare parcel lists in Excel/Google Sheets — CSV is the natural export format for that workflow.

```csv
weight_kg,value_eur,destination_country,reference
0.5,49.99,NL,ORD-001
12.3,1200.00,DE,ORD-002
3.1,89.50,FR,ORD-003
```

- Server parses CSV, validates each row, rejects malformed rows (reports row number + reason)
- Valid rows get IDs assigned and are queued
- Response includes `batch_job_id` for polling progress

---

## Part 5: Frontend — React

### Tech Stack

- React 18 + Vite
- React Router v6 (file-based routing structure)
- Zustand (auth store, parcel store)
- TanStack Query (server state, caching, polling)
- React Hook Form + Zod (form validation)
- Recharts (dashboard charts)
- No UI component library — build all components from scratch

### Design Direction

**Aesthetic: Operational Utility — think Linear, Raycast, GitHub.**

- Palette: **Void Space** — `#0d1117` background, `#161b22` surface, `#58a6ff` primary, `#f78166` accent
- Font: `"IBM Plex Mono"` for IDs/data, `"IBM Plex Sans"` for UI text — clean, technical, honest
- No gradients. No glassmorphism. No pill shapes. No glow effects.
- No rounded corners above 6px on interactive elements
- Status colours: routed=`#3fb950`, hold=`#d29922`, failed=`#f85149`, pending=`#58a6ff`
- Tables are the primary UI pattern for data — not cards
- Sidebar: 240px fixed, `#161b22` background, `1px solid #30363d` right border
- All spacing on the 8px grid: 8 / 16 / 24 / 32 / 48
- Transitions: 150ms ease only on color and opacity, nothing else
- Typography scale: 12 / 13 / 14 / 16 / 20px — never larger than needed
- Density: compact. This is an ops tool, not a marketing page.

### Project Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx                    # router setup
│   ├── stores/
│   │   ├── auth.js               # zustand: user, token, role
│   │   └── notifications.js      # toast queue
│   ├── api/
│   │   ├── client.js             # axios instance, interceptors
│   │   ├── parcels.js
│   │   ├── rules.js
│   │   ├── dashboard.js
│   │   └── auth.js
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.jsx      # sidebar + main content area
│   │   │   ├── Sidebar.jsx
│   │   │   └── Topbar.jsx
│   │   ├── ui/
│   │   │   ├── Badge.jsx         # status badges
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Toast.jsx
│   │   └── parcels/
│   │       ├── ParcelForm.jsx
│   │       ├── ParcelTable.jsx
│   │       ├── ParcelDetail.jsx
│   │       └── BatchUpload.jsx
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── user/
│   │   │   ├── Submit.jsx        # single parcel form
│   │   │   ├── Batch.jsx         # CSV upload
│   │   │   └── MyParcels.jsx     # own submissions
│   │   ├── admin/
│   │   │   ├── Dashboard.jsx     # full observability
│   │   │   ├── Parcels.jsx       # all parcels, all filters
│   │   │   ├── RuleEditor.jsx    # rule builder + test sandbox
│   │   │   ├── RuleHistory.jsx   # version list + diff
│   │   │   └── DeadLetter.jsx    # DLQ management
│   │   └── viewer/
│   │       ├── Dashboard.jsx     # read-only stats
│   │       └── Parcels.jsx       # read-only parcel list
│   └── guards/
│       └── RoleGuard.jsx         # redirect if wrong role
```

### Role Routing

```jsx
// App.jsx
<Routes>
  <Route path="/login" element={<Login />} />

  {/* User routes */}
  <Route element={<RoleGuard allow={['user', 'admin']} />}>
    <Route path="/submit" element={<Submit />} />
    <Route path="/batch" element={<Batch />} />
    <Route path="/my-parcels" element={<MyParcels />} />
  </Route>

  {/* Admin routes */}
  <Route element={<RoleGuard allow={['admin']} />}>
    <Route path="/admin/dashboard" element={<AdminDashboard />} />
    <Route path="/admin/parcels" element={<AdminParcels />} />
    <Route path="/admin/rules" element={<RuleEditor />} />
    <Route path="/admin/rules/history" element={<RuleHistory />} />
    <Route path="/admin/dlq" element={<DeadLetter />} />
  </Route>

  {/* Viewer routes */}
  <Route element={<RoleGuard allow={['viewer', 'admin']} />}>
    <Route path="/viewer/dashboard" element={<ViewerDashboard />} />
    <Route path="/viewer/parcels" element={<ViewerParcels />} />
  </Route>
</Routes>
```

### Sidebar Navigation (per role)

**User sidebar:**
```
Submit Parcel
Batch Upload
My Parcels
```

**Admin sidebar:**
```
Dashboard
All Parcels
Rule Editor
Rule History
Dead Letter Queue
─────────────
[Username]  [Logout]
```

**Viewer sidebar:**
```
Dashboard
Parcels
─────────────
[Username]  [Logout]
```

### Key Page Specs

#### Submit Parcel (User)
- Form fields: Weight (kg), Value (€), Destination Country (searchable select, ISO codes), optional key/value attributes (add/remove rows)
- Validation: weight > 0, value >= 0, country required
- On submit: POST /parcels → show returned parcel ID immediately in a monospace callout
- Clear success/error state — no modals, inline feedback

#### Batch Upload (User + Admin)
- Drag-and-drop CSV upload zone (no decorative icons — functional drop target with dashed border)
- Show parsed preview table before submitting (first 10 rows)
- Validation errors shown per row: `Row 3: missing destination_country`
- After submit: show batch job ID, poll `/dashboard/batch/{id}` every 3s, show live progress bar (simple, not animated)
- Final state shows breakdown: X routed, Y on hold, Z failed

#### Admin Dashboard
- No hero section. No KPI card grid as the opener.
- Start with a compact summary bar: `847 parcels · 12 on hold · 3 failed · 2 in DLQ` — one line, top of page
- Below: a table of recent parcels (last 50), filterable by status / country / date range / department
- Side panel (right, 320px): breakdown chart (Recharts bar chart — department distribution, last 7 days)
- Chart: simple bar chart, no animations, muted colours matching the palette

#### Rule Editor (Admin)
Three-column layout:
```
┌──────────────────┬──────────────────┬──────────────────┐
│  Rule List       │  Rule Form       │  Test Sandbox    │
│  (current chain) │  (edit one rule) │  (dry-run)       │
│                  │                  │                  │
│  1. Insurance ○  │  Type: [select]  │  Input parcels:  │
│  2. Mail Dept ○  │  Field: [select] │  [add test rows] │
│  3. Regular ○    │  Op: [select]    │                  │
│  4. Heavy ○      │  Value: [input]  │  [Run Test]      │
│                  │  Target: [input] │                  │
│  [+ Add Rule]    │                  │  Results table:  │
│                  │  [Save Draft]    │  parcel → dept   │
└──────────────────┴──────────────────┴──────────────────┘
```
- Rules are draggable to reorder (priority = order)
- Save Draft → stores new rule_version (not active)
- Run Test → POST /rules/{id}/test with sample parcels → renders decision per parcel in results table
- Apply Rules button only appears after a successful test, with confirmation: "This will replace the active rule chain. Continue?"
- If apply fails validation → show exact error inline, no toast

#### Rule History (Admin)
- Table: version number / created / tested / applied / applied by / status (DRAFT / ACTIVE / SUPERSEDED)
- Click any row: expand to show full config JSON (syntax highlighted, read-only)
- Diff button between any two versions: side-by-side JSON diff view
- Cannot revert to old version directly — must re-apply (forces admin to review)

#### Dead Letter Queue (Admin)
- Table: parcel ID / error message / failed at / retry count
- Per-row actions: Retry (re-queues task) / Dismiss (marks as resolved with reason)
- Bulk retry / bulk dismiss
- No data state: `"No items in the dead letter queue"` — plain text, no illustration

#### Parcel Detail (all roles, filtered by permission)
```
PCL-20260524-NL-00042          ROUTED
────────────────────────────────────────
Weight          3.2 kg
Value           €249.00
Destination     NL (Netherlands)
Department      Regular Department
Submitted by    jsmith
Submitted at    2026-05-24 14:33:02 UTC

Routing Decision
────────────────────────────────────────
Rules evaluated:
  1. insurance-gate   → not applicable (value ≤ €1,000)
  2. mail-dept        → not applicable (weight > 1 kg)
  3. regular-dept     → MATCHED → Regular Department

Audit Trail
────────────────────────────────────────
14:33:01  CREATED     jsmith
14:33:02  QUEUED      system
14:33:03  ROUTED      system → Regular Department
```

---

## Part 6: Docker Compose

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: parcels
      POSTGRES_USER: parcels
      POSTGRES_PASSWORD: parcels
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  rabbitmq:
    image: rabbitmq:3.13-management
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"   # management UI

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+asyncpg://parcels:parcels@postgres:5432/parcels
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672//
      JWT_SECRET_KEY: changeme
    depends_on:
      - postgres
      - rabbitmq
    ports:
      - "8000:8000"

  worker:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info -Q routing.single,routing.batch
    environment:
      DATABASE_URL: postgresql+asyncpg://parcels:parcels@postgres:5432/parcels
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672//
    depends_on:
      - postgres
      - rabbitmq

  frontend:
    build: ./frontend
    command: npm run dev -- --host
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: http://localhost:8000

volumes:
  postgres_data:
```

---

## Part 7: Design Rules (Enforced)

These are non-negotiable for the frontend:

1. **No gradient backgrounds** — solid colours only
2. **No rounded corners above 6px** — buttons 4px, cards 6px, inputs 4px
3. **No glassmorphism** — no `backdrop-filter`, no translucent panels
4. **No pill shapes** — badges are rectangular with 4px radius
5. **No animation above 150ms** — colour and opacity only, no transforms
6. **No hero sections inside app pages** — first visible element is always data or a form
7. **No decorative copy** — no taglines, no eyebrow labels, no marketing language
8. **Status colours are semantic and consistent**: 
   - ROUTED → `#3fb950`
   - INSURANCE_HOLD → `#d29922`
   - FAILED → `#f85149`
   - PENDING/QUEUED → `#58a6ff`
   - DEAD_LETTER → `#8b949e`
9. **Parcel IDs always monospace** — `font-family: 'IBM Plex Mono'`
10. **Tables over cards for list data** — always

---

## Part 8: Testing Requirements

### Backend
- Unit tests for each routing rule (pytest)
- Integration test: submit parcel → task queued → worker routes → status updated
- Rule validation tests: malformed config rejected, gap detection, overlap detection
- Auth tests: role guards block correctly

### Frontend
- Rule editor: test panel shows correct decisions for known inputs
- Batch upload: malformed CSV rows flagged with row number
- Parcel detail: audit trail renders in correct order

---

## Part 9: Seed Data

On first run, seed:

```sql
-- Admin user (password: admin123)
INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'admin', 'admin@parcels.io', '<hashed>', 'admin');

-- Viewer user
INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'viewer', 'viewer@parcels.io', '<hashed>', 'viewer');

-- Regular user
INSERT INTO users (id, username, email, password_hash, role)
VALUES (gen_random_uuid(), 'jsmith', 'jsmith@parcels.io', '<hashed>', 'user');

-- Initial active rule version (the default routing rules)
INSERT INTO rule_versions (version_number, config, applied_at, applied_by, is_active)
VALUES (1, '<default_rules_json>', NOW(), '<admin_id>', TRUE);
```

---

## Summary Checklist

- [ ] PostgreSQL schema with versioned rules, audit log, JSONB attributes
- [ ] Parcel ID format: `PCL-{YYYYMMDD}-{COUNTRY}-{SEQ}`
- [ ] FastAPI with JWT auth, role guards, async SQLAlchemy
- [ ] Rule engine: chain of responsibility, config-driven, validated on apply
- [ ] Celery + RabbitMQ: separate queues for single/batch/DLQ
- [ ] CSV batch upload with per-row validation and live progress polling
- [ ] React frontend: 3 roles, distinct navigation per role
- [ ] Rule editor: draft → test → apply flow, no apply without passing test
- [ ] Rule history: versioned, diffable, no silent overwrites
- [ ] Admin dashboard: compact summary bar, parcel table, department chart
- [ ] Dead letter queue management with retry/dismiss
- [ ] Parcel detail with full routing decision trace and audit trail
- [ ] Docker Compose: all services, health checks, seed data
- [ ] Frontend: Void Space palette, IBM Plex fonts, no AI-slop patterns

---

## Part 10: Python Tooling — uv

**Never use pip, virtualenv, or poetry. Use `uv` for everything.**

### Install uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Backend pyproject.toml

```toml
[project]
name = "parcel-routing-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.111.0",
  "uvicorn[standard]>=0.29.0",
  "sqlalchemy[asyncio]>=2.0.0",
  "asyncpg>=0.29.0",
  "alembic>=1.13.0",
  "celery[rabbitmq]>=5.4.0",
  "pydantic>=2.7.0",
  "pydantic-settings>=2.2.0",
  "python-jose[cryptography]>=3.3.0",
  "passlib[bcrypt]>=1.7.4",
  "python-multipart>=0.0.9",
  "httpx>=0.27.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2.0",
  "pytest-asyncio>=0.23.0",
  "pytest-cov>=5.0.0",
  "httpx>=0.27.0",
  "ruff>=0.4.0",
  "mypy>=1.10.0",
]

[tool.ruff]
line-length = 88
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.mypy]
python_version = "3.12"
strict = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### Common uv commands (local dev)

```bash
# Create venv and install all deps
uv sync

# Install with dev deps
uv sync --extra dev

# Add a new dependency
uv add httpx

# Add a dev-only dependency
uv add --dev pytest-asyncio

# Run a command inside the venv
uv run uvicorn app.main:app --reload
uv run celery -A app.workers.celery_app worker --loglevel=info
uv run alembic upgrade head
uv run pytest

# Update lockfile after changing pyproject.toml
uv lock

# Export requirements.txt (only needed for Docker layer caching)
uv export --no-dev --format requirements-txt > requirements.txt
```

### Dockerfile (backend + worker — same image, different CMD)

```dockerfile
FROM python:3.12-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy lockfile and pyproject first for layer caching
COPY pyproject.toml uv.lock ./

# Install production deps only, into system Python (no venv needed in container)
RUN uv sync --no-dev --system

# Copy source
COPY . .

# Backend default — overridden per service in docker-compose.yml
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Part 11: Makefile

Place this `Makefile` at the **monorepo root** alongside `backend/`, `frontend/`, and `docker-compose.yml`.

```makefile
# =============================================================================
# Parcel Routing System — Makefile
# Usage: make <target>
# =============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash

BOLD  := \033[1m
GREEN := \033[32m
CYAN  := \033[36m
RESET := \033[0m

BACKEND_DIR  := backend
FRONTEND_DIR := frontend

# =============================================================================
# Help
# =============================================================================

.PHONY: help
help:
	@echo ""
	@echo "$(BOLD)Parcel Routing System$(RESET)"
	@echo ""
	@echo "$(CYAN)Setup$(RESET)"
	@echo "  make install           Install all deps (backend + frontend)"
	@echo "  make install-backend   Install backend deps via uv"
	@echo "  make install-frontend  Install frontend deps via npm"
	@echo ""
	@echo "$(CYAN)Development$(RESET)"
	@echo "  make dev               Start all services via docker compose"
	@echo "  make dev-backend       Run FastAPI locally (no docker)"
	@echo "  make dev-worker        Run Celery worker locally (no docker)"
	@echo "  make dev-frontend      Run Vite dev server locally"
	@echo ""
	@echo "$(CYAN)Database$(RESET)"
	@echo "  make migrate           Run alembic migrations (upgrade head)"
	@echo "  make migrate-down      Downgrade one migration step"
	@echo "  make migration msg=    Create a new migration (msg required)"
	@echo "  make seed              Seed database with initial data"
	@echo "  make db-reset          Drop, recreate, migrate, and seed"
	@echo ""
	@echo "$(CYAN)Code Quality$(RESET)"
	@echo "  make lint              Ruff linter"
	@echo "  make lint-fix          Ruff linter with autofix"
	@echo "  make format            Ruff formatter"
	@echo "  make typecheck         Mypy type checking"
	@echo "  make check             lint + typecheck + test (CI gate)"
	@echo ""
	@echo "$(CYAN)Testing$(RESET)"
	@echo "  make test              Run all backend tests"
	@echo "  make test-cov          Tests with coverage report"
	@echo "  make test-watch        Tests in watch mode"
	@echo ""
	@echo "$(CYAN)Docker$(RESET)"
	@echo "  make build             Build all docker images"
	@echo "  make up                Start containers (detached)"
	@echo "  make down              Stop and remove containers"
	@echo "  make restart           down + up"
	@echo "  make logs              Tail all service logs"
	@echo "  make logs-backend      Tail backend logs"
	@echo "  make logs-worker       Tail worker logs"
	@echo "  make ps                List running containers"
	@echo ""
	@echo "$(CYAN)Utilities$(RESET)"
	@echo "  make shell-backend     bash inside backend container"
	@echo "  make shell-db          psql inside postgres container"
	@echo "  make rabbitmq-ui       Open RabbitMQ management UI"
	@echo "  make clean             Remove containers, volumes, caches"
	@echo ""

# =============================================================================
# Setup
# =============================================================================

.PHONY: install
install: install-backend install-frontend
	@echo "$(GREEN)All dependencies installed.$(RESET)"

.PHONY: install-backend
install-backend:
	@echo "Installing backend deps with uv..."
	cd $(BACKEND_DIR) && uv sync --extra dev

.PHONY: install-frontend
install-frontend:
	@echo "Installing frontend deps..."
	cd $(FRONTEND_DIR) && npm install

# =============================================================================
# Development (local, without docker)
# =============================================================================

.PHONY: dev-backend
dev-backend:
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

.PHONY: dev-worker
dev-worker:
	cd $(BACKEND_DIR) && uv run celery -A app.workers.celery_app worker \
		--loglevel=info \
		-Q routing.single,routing.batch \
		--concurrency=4

.PHONY: dev-frontend
dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# =============================================================================
# Database
# =============================================================================

.PHONY: migrate
migrate:
	cd $(BACKEND_DIR) && uv run alembic upgrade head

.PHONY: migrate-down
migrate-down:
	cd $(BACKEND_DIR) && uv run alembic downgrade -1

.PHONY: migration
migration:
ifndef msg
	$(error msg is required. Usage: make migration msg="add index on parcel status")
endif
	cd $(BACKEND_DIR) && uv run alembic revision --autogenerate -m "$(msg)"

.PHONY: seed
seed:
	cd $(BACKEND_DIR) && uv run python -m app.scripts.seed

.PHONY: db-reset
db-reset: down
	@echo "Resetting database..."
	docker compose up -d postgres
	@sleep 2
	$(MAKE) migrate
	$(MAKE) seed
	@echo "$(GREEN)Database reset complete.$(RESET)"

# =============================================================================
# Code Quality
# =============================================================================

.PHONY: lint
lint:
	cd $(BACKEND_DIR) && uv run ruff check .

.PHONY: lint-fix
lint-fix:
	cd $(BACKEND_DIR) && uv run ruff check . --fix

.PHONY: format
format:
	cd $(BACKEND_DIR) && uv run ruff format .

.PHONY: typecheck
typecheck:
	cd $(BACKEND_DIR) && uv run mypy app/

.PHONY: check
check: lint typecheck test
	@echo "$(GREEN)All checks passed.$(RESET)"

# =============================================================================
# Testing
# =============================================================================

.PHONY: test
test:
	cd $(BACKEND_DIR) && uv run pytest -v

.PHONY: test-cov
test-cov:
	cd $(BACKEND_DIR) && uv run pytest --cov=app --cov-report=term-missing --cov-report=html

.PHONY: test-watch
test-watch:
	cd $(BACKEND_DIR) && uv run pytest-watch

# =============================================================================
# Docker
# =============================================================================

.PHONY: build
build:
	docker compose build

.PHONY: up
up:
	docker compose up -d
	@echo "$(GREEN)API: http://localhost:8000  UI: http://localhost:5173  RabbitMQ: http://localhost:15672$(RESET)"

.PHONY: dev
dev:
	docker compose up

.PHONY: down
down:
	docker compose down

.PHONY: restart
restart: down up

.PHONY: logs
logs:
	docker compose logs -f

.PHONY: logs-backend
logs-backend:
	docker compose logs -f backend

.PHONY: logs-worker
logs-worker:
	docker compose logs -f worker

.PHONY: ps
ps:
	docker compose ps

# =============================================================================
# Utilities
# =============================================================================

.PHONY: shell-backend
shell-backend:
	docker compose exec backend bash

.PHONY: shell-db
shell-db:
	docker compose exec postgres psql -U parcels -d parcels

.PHONY: rabbitmq-ui
rabbitmq-ui:
	@open http://localhost:15672 2>/dev/null || xdg-open http://localhost:15672

.PHONY: clean
clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .ruff_cache -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	cd $(FRONTEND_DIR) && rm -rf node_modules dist 2>/dev/null || true
	@echo "$(GREEN)Clean complete.$(RESET)"
```

### Quick-start from zero

```bash
git clone <repo>
cd parcel-routing

make install        # uv sync + npm install
docker compose up -d postgres rabbitmq
make migrate        # alembic upgrade head
make seed           # seed users + default rules
make dev-backend    # FastAPI on :8000
make dev-worker     # Celery consumer
make dev-frontend   # Vite on :5173
```

Or the one-liner with everything in Docker:

```bash
make build && make up && make migrate && make seed
```

---

## Updated Summary Checklist

- [ ] PostgreSQL schema with versioned rules, audit log, JSONB attributes
- [ ] Parcel ID format: `PCL-{YYYYMMDD}-{COUNTRY}-{SEQ}`
- [ ] FastAPI with JWT auth, role guards, async SQLAlchemy
- [ ] Rule engine: chain of responsibility, config-driven, validated on apply
- [ ] Celery + RabbitMQ: three queues (single / batch / DLQ)
- [ ] CSV batch upload with per-row validation and live progress polling
- [ ] React frontend: 3 roles, distinct navigation per role
- [ ] Rule editor: draft → test → apply flow, no apply without passing test
- [ ] Rule history: versioned, diffable, no silent overwrites
- [ ] Admin dashboard: compact summary bar, parcel table, department chart
- [ ] Dead letter queue management with retry/dismiss
- [ ] Parcel detail with full routing decision trace and audit trail
- [ ] Docker Compose: all services with health checks
- [ ] **uv for all Python dependency management — no pip**
- [ ] **pyproject.toml with dev extras (ruff, mypy, pytest)**
- [ ] **uv.lock committed to version control**
- [ ] **Makefile at monorepo root with all targets documented**
- [ ] Frontend: Void Space palette, IBM Plex fonts, no AI-slop patterns
