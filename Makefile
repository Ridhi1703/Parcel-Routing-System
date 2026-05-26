# =============================================================================
# Parcel Routing System — Makefile
# Usage: make <target>
#
# Workflow: postgres + rabbitmq run in Docker; backend + frontend run locally.
# =============================================================================

.DEFAULT_GOAL := help
SHELL         := /bin/bash

BOLD  := $(shell printf '\033[1m')
GREEN := $(shell printf '\033[32m')
CYAN  := $(shell printf '\033[36m')
RESET := $(shell printf '\033[0m')

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
	@echo "$(CYAN)Quick Start$(RESET)"
	@echo "  make dev               Start everything (infra + backend + worker + frontend)"
	@echo "  make stop / dev-down   Stop infra and kill dev processes"
	@echo "  make logs              Tail all service logs"
	@echo ""
	@echo "$(CYAN)Setup$(RESET)"
	@echo "  make install           Install all deps (backend + frontend)"
	@echo "  make install-backend   Install backend deps via uv"
	@echo "  make install-frontend  Install frontend deps via npm"
	@echo "  make setup             Copy .env.example → .env (if not exists)"
	@echo ""
	@echo "$(CYAN)Infrastructure (Docker)$(RESET)"
	@echo "  make infra             Start postgres + rabbitmq in Docker (detached)"
	@echo "  make infra-down        Stop infra containers"
	@echo "  make infra-logs        Tail infra logs"
	@echo "  make ps                List running containers"
	@echo ""
	@echo "$(CYAN)Development (local)$(RESET)"
	@echo "  make dev-backend       Run FastAPI on :8000"
	@echo "  make dev-worker        Run Celery worker"
	@echo "  make dev-frontend      Run Vite on :5173"
	@echo ""
	@echo "$(CYAN)Database$(RESET)"
	@echo "  make migrate           Run alembic migrations (upgrade head)"
	@echo "  make migrate-down      Downgrade one migration step"
	@echo "  make migration msg=    Create a new migration (msg required)"
	@echo "  make seed              Seed database with initial data"
	@echo "  make db-reset          Stop infra, restart, migrate, seed"
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
	@echo ""
	@echo "$(CYAN)Utilities$(RESET)"
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

.PHONY: setup
setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN).env created from .env.example — set JWT_SECRET_KEY before running.$(RESET)"; \
	else \
		echo ".env already exists, skipping."; \
	fi

# Guard: fail fast with a clear message if .env is missing
.env:
	@echo "$(BOLD)Error:$(RESET) .env file not found. Run: make setup"
	@exit 1

# =============================================================================
# Infrastructure (Docker — postgres + rabbitmq only)
# =============================================================================

.PHONY: infra
infra:
	docker compose up -d postgres rabbitmq
	@echo "$(GREEN)Postgres:  localhost:5432$(RESET)"
	@echo "$(GREEN)RabbitMQ:  localhost:5672  management: http://localhost:15672$(RESET)"

.PHONY: infra-down
infra-down:
	docker compose stop postgres rabbitmq

.PHONY: infra-logs
infra-logs:
	docker compose logs -f postgres rabbitmq

.PHONY: ps
ps:
	docker compose ps

# =============================================================================
# Development (local processes)
# =============================================================================

.PHONY: dev-backend
dev-backend: .env
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload


.PHONY: dev-worker
dev-worker: .env
	cd $(BACKEND_DIR) && uv run celery -A app.workers.celery_app worker \
		--pool=solo \
		--loglevel=info \
		-Q routing.single,routing.batch

.PHONY: dev-frontend
dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# =============================================================================
# Database
# =============================================================================

.PHONY: migrate
migrate: .env
	cd $(BACKEND_DIR) && uv run alembic upgrade head

.PHONY: migrate-down
migrate-down: .env
	cd $(BACKEND_DIR) && uv run alembic downgrade -1

.PHONY: migration
migration: .env
ifndef msg
	$(error msg is required. Usage: make migration msg="add index on parcel status")
endif
	cd $(BACKEND_DIR) && uv run alembic revision --autogenerate -m "$(msg)"

.PHONY: seed
seed: .env
	cd $(BACKEND_DIR) && uv run python -m app.scripts.seed

.PHONY: db-reset
db-reset: infra-down
	@echo "Resetting database..."
	docker compose up -d postgres
	@echo "Waiting for postgres..."
	@sleep 3
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

# =============================================================================
# Utilities
# =============================================================================

.PHONY: shell-db
shell-db:
	docker compose exec postgres psql -U $${DB_USER:-parcels} -d $${DB_NAME:-parcels}

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

.PHONY: start
start: dev

.PHONY: stop
stop: dev-down

.PHONY: dev
dev: .env
	@echo "$(GREEN)Starting ParcelFlow — infra + backend + worker + frontend$(RESET)"
	@$(MAKE) infra
	@echo "Waiting for postgres + rabbitmq to be ready..."
	@sleep 4
	@$(MAKE) migrate
	@echo ""
	@echo "$(BOLD)Launching backend, worker and frontend in background...$(RESET)"
	@echo "  Backend  → http://127.0.0.1:8000"
	@echo "  Frontend → http://localhost:5173"
	@echo "  Logs     → /tmp/pf-backend.log  /tmp/pf-worker.log  /tmp/pf-frontend.log"
	@echo "  Stop     → make dev-down"
	@echo ""
	@cd $(BACKEND_DIR) && nohup uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 \
		> /tmp/pf-backend.log 2>&1 &  echo "backend PID $$!" > /tmp/pf-backend.pid
	
	@cd $(BACKEND_DIR) && nohup uv run celery -A app.workers.celery_app worker \
	--pool=solo --loglevel=info -Q routing.single,routing.batch \
		> /tmp/pf-worker.log 2>&1 & echo "worker PID $$!" > /tmp/pf-worker.pid


	@cd $(FRONTEND_DIR) && nohup npm run dev \
		> /tmp/pf-frontend.log 2>&1 & echo "frontend PID $$!" > /tmp/pf-frontend.pid
	@echo "$(GREEN)All services started. Use 'make logs' to tail output.$(RESET)"

.PHONY: dev-down
dev-down:
	@echo "Stopping dev processes..."
	@[ -f /tmp/pf-backend.pid ]  && kill $$(cat /tmp/pf-backend.pid)  2>/dev/null && rm /tmp/pf-backend.pid  || true
	@[ -f /tmp/pf-worker.pid ]   && kill $$(cat /tmp/pf-worker.pid)   2>/dev/null && rm /tmp/pf-worker.pid   || true
	@[ -f /tmp/pf-frontend.pid ] && kill $$(cat /tmp/pf-frontend.pid) 2>/dev/null && rm /tmp/pf-frontend.pid || true
	@$(MAKE) infra-down
	@echo "$(GREEN)All services stopped.$(RESET)"

.PHONY: logs
logs:
	@tail -f /tmp/pf-backend.log /tmp/pf-worker.log /tmp/pf-frontend.log