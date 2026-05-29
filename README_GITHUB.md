# 📦 ParcelFlow

> Adaptive Parcel Routing System built with FastAPI, React, PostgreSQL, RabbitMQ, and Celery.

ParcelFlow is a modern parcel routing platform that automates parcel classification, routing, tracking, and rule management through a configurable rule engine.

Designed to demonstrate scalable system design, asynchronous processing, security, testing practices, and business-rule adaptability.

---

## ✨ Features

### 📦 Parcel Routing

* Automatic parcel classification
* Weight-based routing
* Insurance approval workflows
* Destination-aware routing
* Custom rule support

### ⚙️ Dynamic Rule Engine

* Create rules without code changes
* Rule priorities
* AND / OR condition support
* Rule versioning
* Rule validation
* Safe rule deployment

### 📊 Operational Visibility

* Audit logging
* Parcel status tracking
* Processing history
* Error tracking
* Dead-letter handling

### 🚀 Batch Processing

* CSV upload support
* Bulk parcel submission
* Asynchronous processing
* Progress tracking

### 🔒 Security

* JWT Authentication
* Role-Based Access Control (RBAC)
* Input validation
* Protected API endpoints

---

## 🏗️ Architecture

```text
┌─────────────────────┐
│      React UI       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     FastAPI API     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      RabbitMQ       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Celery Workers    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    PostgreSQL DB    │
└─────────────────────┘
```

### Why This Architecture?

* Responsive UI during large batch processing
* Independent scaling of workers
* Better fault isolation
* Improved reliability
* Easier maintenance

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* Material UI
* Axios

### Backend

* FastAPI
* SQLAlchemy
* Pydantic
* Alembic

### Infrastructure

* PostgreSQL
* RabbitMQ
* Celery
* Docker

### Testing

* Pytest
* Pytest-Cov

---

## 📁 Project Structure

```text
ParcelFlow/

├── frontend/
│   ├── src/
│   └── public/
│
├── backend/
│   ├── app/
│   ├── tests/
│   └── alembic/
│
├── docs/
│   ├── testing-strategy.md
│   ├── regression-checklist.md
│   ├── development-workflow.md
│   └── ai-usage.md
│
├── docker-compose.yml
├── Dockerfile
├── README.md
└── README_GITHUB.md
```

---

## 🚀 Quick Start

### Clone Repository

```bash
git clone <repository-url>
cd ParcelFlow
```

### Configure Environment

```bash
cp .env.example .env
```

Update environment variables:

```env
DATABASE_URL=
RABBITMQ_URL=
JWT_SECRET_KEY=
```

### Start Infrastructure

```bash
docker compose up -d
```

### Backend

```bash
cd backend
uvicorn app.main:app --reload
```

### Worker

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Running Tests

Run all tests:

```bash
pytest
```

Run coverage:

```bash
pytest --cov=app
```

Current test coverage focuses on:

* Routing logic
* Rule evaluation
* Authentication
* Validation

---

## 🔄 Example Routing Rules

| Condition     | Department         |
| ------------- | ------------------ |
| Weight ≤ 1kg  | Mail Department    |
| Weight ≤ 10kg | Regular Department |
| Weight > 10kg | Heavy Department   |
| Value > €1000 | Insurance Approval |

Example:

```json
{
  "weight_kg": 12,
  "value_eur": 500,
  "destination_country": "DE"
}
```

Result:

```json
{
  "department": "Heavy Department"
}
```

---

## 📈 Future Enhancements

* Rule simulation engine
* Real-time notifications
* Grafana dashboards
* Prometheus metrics
* Kubernetes deployment
* Multi-factor authentication
* Advanced analytics

---

## 🎯 Project Highlights

✔ Dynamic Rule Engine

✔ Rule Versioning

✔ RabbitMQ + Celery Architecture

✔ Dead Letter Queue Support

✔ Audit Logging

✔ Batch Processing

✔ JWT Authentication

✔ Automated Testing

✔ Extensible Design

---

## 👨‍💻 Author

**Prajwal Zoting**

ParcelFlow was developed as part of a technical assessment focused on:

* Engineering Judgment
* Adaptability
* System Design
* Testing Discipline
* Reliability
* Security
* Responsible AI Usage

---

## 📄 Additional Documentation

See:

* `README.md` → Assessment-focused documentation
* `docs/testing-strategy.md`
* `docs/regression-checklist.md`
* `docs/development-workflow.md`
* `docs/ai-usage.md`
