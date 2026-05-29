# ParcelFlow – Adaptive Parcel Routing System

## Overview

ParcelFlow is a production-ready parcel routing system designed to automate parcel classification and routing using configurable business rules.

The system was built to address a common logistics challenge: routing parcels accurately while allowing business teams to safely modify routing behavior without requiring application code changes.

The solution combines a React frontend, FastAPI backend, PostgreSQL database, RabbitMQ message broker, and Celery workers to provide a scalable and maintainable architecture.

Key goals of the project:

* Adapt to changing business requirements
* Process parcels reliably and asynchronously
* Provide visibility into routing decisions
* Enable safe rule evolution
* Demonstrate engineering practices beyond basic CRUD development

---

# Business Problem

A parcel delivery company needs a routing system that can automatically determine which department should handle a parcel.

Each parcel contains:

* Weight (kg)
* Value (€)
* Destination country
* Optional custom attributes

Default routing rules:

| Condition     | Department                  |
| ------------- | --------------------------- |
| Weight ≤ 1kg  | Mail Department             |
| Weight ≤ 10kg | Regular Department          |
| Weight > 10kg | Heavy Department            |
| Value > €1000 | Insurance Approval Required |

The primary challenge is that routing rules change over time.

Hardcoding business logic directly into application code creates operational risk because every rule change requires a code deployment.

ParcelFlow solves this problem through a configurable rule engine that separates business rules from application logic.

---

# Assessment Requirement Mapping

| Requirement    | Implementation                                        |
| -------------- | ----------------------------------------------------- |
| Parcel Routing | Dynamic rule engine with configurable routing rules   |
| Adaptability   | Rule versioning and configurable rule evaluation      |
| User Interface | React-based operator interface                        |
| Batch Upload   | CSV-based bulk parcel processing                      |
| Testing        | Automated unit tests and regression strategy          |
| Monitoring     | Audit logs, status tracking, dead-letter handling     |
| Reliability    | Asynchronous processing with RabbitMQ and Celery      |
| Security       | JWT authentication and role-based access control      |
| AI Usage       | AI-assisted development with documented modifications |

---

# Key Features

## Dynamic Rule Engine

Instead of hardcoded routing logic:

```python
if weight <= 1:
    route = "Mail Department"
```

ParcelFlow evaluates routing decisions using configurable rules stored and managed independently from application code.

Features:

* Priority-based evaluation
* Multiple conditions per rule
* AND / OR logic support
* Rule validation
* Rule versioning
* Backward compatibility

---

## Rule Versioning

Business rules follow a controlled lifecycle:

```text
Draft
 ↓
Test
 ↓
Apply
 ↓
Active Version
```

Benefits:

* Safe rule changes
* Reduced production risk
* Full change history
* Rollback capability

---

## Batch Processing

Operators can upload multiple parcels simultaneously through CSV imports.

Features:

* Bulk submission
* Validation before processing
* Progress tracking
* Error reporting
* Asynchronous execution

---

## Role-Based Access Control

Three user roles are supported:

| Role   | Access                   |
| ------ | ------------------------ |
| Admin  | Full system access       |
| User   | Submit and track parcels |
| Viewer | Read-only access         |

---

## Audit Trail

Every significant system action is recorded.

Examples:

* Parcel created
* Parcel queued
* Rule evaluated
* Routing completed
* Routing failed
* Rule modified

This improves traceability and supports debugging and operational investigations.

---

# System Architecture

```text
┌─────────────────────┐
│     React UI        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    FastAPI API      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     RabbitMQ        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Celery Workers    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    PostgreSQL       │
└─────────────────────┘
```

### Why This Architecture?

The architecture separates responsibilities across multiple components.

Benefits:

* Independent scaling
* Better fault isolation
* Improved reliability
* Faster user experience
* Easier maintenance

For example, routing large batches does not block the user interface because processing occurs asynchronously through RabbitMQ and Celery.

---

# Routing Engine Design

The routing engine is the core component of ParcelFlow.

Each parcel is evaluated against a prioritized set of rules.

Example:

```text
Insurance Rule
      ↓
Mail Rule
      ↓
Regular Rule
      ↓
Heavy Rule
      ↓
Fallback
```

The first matching rule determines the routing outcome.

Benefits:

* Easily extensible
* Predictable behavior
* Simple debugging
* Clear business ownership

New routing rules can be introduced without major application refactoring.

---

# Key Engineering Decisions

## Why Configuration-Based Rules?

Business requirements change more frequently than application architecture.

Separating rules from code allows:

* Faster adaptation
* Reduced deployment risk
* Better maintainability
* Safer experimentation

## Why RabbitMQ + Celery?

Routing can become expensive when processing large batches.

Asynchronous processing:

* Prevents API timeouts
* Improves user experience
* Supports horizontal scaling
* Enables retry mechanisms

## Why PostgreSQL?

PostgreSQL provides:

* Reliability
* Transaction support
* Strong consistency
* Mature tooling

making it well-suited for operational systems.

# Security

Because the application is intended to be deployed on the public internet, several security measures have been implemented.

## Authentication

ParcelFlow uses JWT-based authentication.

Features:

* Secure token generation
* Token expiration support
* Protected API endpoints
* User identity verification

## Authorization

Role-based access control ensures users only access functionality relevant to their role.

Examples:

* Admins can manage rules and users
* Users can only view their own parcels
* Viewers have read-only access

## Input Validation

All incoming requests are validated using Pydantic schemas.

Benefits:

* Prevents malformed requests
* Reduces unexpected application behavior
* Improves API reliability

## Database Security

The application uses SQLAlchemy ORM rather than raw SQL queries.

Benefits:

* Reduces SQL injection risk
* Improves maintainability
* Encourages safer database access patterns

## Additional Security Measures (Future Work)

For a production environment, additional controls would be recommended:

* Rate limiting
* Multi-factor authentication
* Security headers
* Web Application Firewall (WAF)
* Centralized secret management
* Audit event alerting

---

# Monitoring & Reliability

A routing system must provide visibility into failures and operational behavior.

## Audit Logging

Every important action is recorded.

Examples:

* Parcel creation
* Queue submission
* Routing completion
* Rule modifications
* User actions

Benefits:

* Easier debugging
* Compliance support
* Historical traceability

## Status Tracking

Parcels move through explicit states:

```text
CREATED
↓
QUEUED
↓
PROCESSING
↓
ROUTED
```

Possible failure states:

```text
FAILED
DEAD_LETTER
```

This makes operational issues visible and easier to investigate.

## Dead Letter Handling

Failed parcels are not silently discarded.

Instead, they are routed to a dead-letter workflow where administrators can:

* Review failures
* Retry processing
* Dismiss invalid items

This improves reliability and operational control.

## Future Monitoring Enhancements

Potential future improvements include:

* Prometheus metrics
* Grafana dashboards
* Sentry error tracking
* Automated alerting
* Routing anomaly detection

---

# Testing Strategy

Testing focuses on protecting the most critical business functionality: routing decisions.

## Automated Tests

Current automated tests include:

### Authentication Tests

* JWT generation
* JWT validation
* Invalid token handling

### Rule Engine Tests

* Weight-based routing
* Insurance approval logic
* Rule priority handling
* Boundary conditions
* Multi-condition rules
* Validation logic
* Backward compatibility

Example routing tests:

```text
Weight ≤ 1kg
→ Mail Department

Weight ≤ 10kg
→ Regular Department

Weight > 10kg
→ Heavy Department

Value > €1000
→ Insurance Hold
```

## Regression Protection

A regression checklist is maintained to verify critical functionality after changes.

Examples:

* Authentication
* Parcel submission
* Routing
* Rule management
* Batch uploads

## Beyond Automated Tests

Additional validation approaches include:

* Manual exploratory testing
* Boundary testing
* User acceptance testing
* End-to-end workflow verification

---

# AI Usage

AI tools were intentionally used during development to improve productivity.

## Example 1 – Rule Engine Design

Prompt:

```text
Design a configurable parcel routing rule engine that supports future rule expansion.
```

AI Assistance:

* Generated an initial architecture concept.

Developer Modifications:

* Added rule versioning
* Added validation layer
* Added priority ordering
* Added auditability features

Reason:

The generated design required stronger operational controls and safer rule management.

---

## Example 2 – Documentation and Deployment

Prompt:

```text
Generate deployment and documentation recommendations for a FastAPI, React, RabbitMQ, and PostgreSQL application.
```

AI Assistance:

* Suggested deployment options
* Suggested README structure

Developer Modifications:

* Adapted recommendations to project requirements
* Selected deployment approaches appropriate for demonstration purposes

## Reflection

AI accelerated development and documentation.

However:

* Generated code required review
* Business logic decisions remained developer-owned
* Security decisions required manual verification
* Testing remained essential

AI was treated as an assistant rather than an authority.

---

# Extending The System

A key design goal was adaptability.

New routing rules can be introduced without major refactoring.

Example:

```text
IF destination_country = "DE"
AND value > 500

THEN route to European Processing Department
```

Typical process:

1. Create rule
2. Validate configuration
3. Test in sandbox
4. Apply version
5. Monitor results

No application code changes are required.

---

# Deployment

The application consists of:

```text
Frontend
Backend
Worker
Database
Message Broker
```

Deployment options include:

| Component | Recommended Platform |
| --------- | -------------------- |
| Frontend  | Vercel               |
| Backend   | Render               |
| Database  | Neon PostgreSQL      |
| RabbitMQ  | CloudAMQP            |
| Worker    | Render Worker        |

For local development, Docker Compose can be used to run infrastructure services.

---

# Tradeoffs

Several design tradeoffs were considered.

## Dynamic Rules vs Hardcoded Logic

Chosen:

```text
Dynamic Rules
```

Pros:

* Flexible
* Easier business changes

Cons:

* More validation required
* More complex implementation

---

## Asynchronous Processing vs Synchronous Processing

Chosen:

```text
Asynchronous Processing
```

Pros:

* Better scalability
* Better user experience

Cons:

* Increased infrastructure complexity

---

## Auditability vs Simplicity

Chosen:

```text
Auditability
```

Pros:

* Better debugging
* Better traceability

Cons:

* Additional storage and implementation effort

---

# Future Improvements

Potential enhancements include:

* Graph-based rule visualization
* Rule simulation environment
* Multi-factor authentication
* Real-time notifications
* Prometheus and Grafana monitoring
* Automated anomaly detection
* Kubernetes deployment support

---

# Demo Credentials

| Username | Password  | Role   |
| -------- | --------- | ------ |
| admin    | admin123  | Admin  |
| viewer   | viewer123 | Viewer |
| jsmith   | user123   | User   |

---

# Quick Start

## Clone Repository

```bash
git clone <repository-url>
cd ParcelFlow
```

## Setup Environment

```bash
cp .env.example .env
```

Configure:

```env
DB_HOST=
DB_USER=
DB_PASSWORD=
RABBITMQ_HOST=
JWT_SECRET_KEY=
```

## Start Infrastructure

```bash
make infra
```

## Run Database Migrations

```bash
make migrate
```

## Seed Sample Data

```bash
make seed
```

## Start Services

Backend:

```bash
make dev-backend
```

Worker:

```bash
make dev-worker
```

Frontend:

```bash
make dev-frontend
```

---

# Conclusion

ParcelFlow demonstrates a configurable, secure, and extensible parcel routing platform that emphasizes adaptability, reliability, testing, and operational visibility.

The project was intentionally designed to support evolving business requirements while maintaining safe deployment practices and a clear separation of concerns.
