"""Initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-05-24
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(64), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "parcels",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("weight_kg", sa.Numeric(10, 3), nullable=False),
        sa.Column("value_eur", sa.Numeric(12, 2), nullable=False),
        sa.Column("destination_country", sa.String(2), nullable=False),
        sa.Column("attributes", postgresql.JSONB, default={}),
        sa.Column("status", sa.String(32), nullable=False, default="PENDING"),
        sa.Column(
            "submitted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "routing_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "parcel_id", sa.String(32), sa.ForeignKey("parcels.id"), nullable=False
        ),
        sa.Column("rules_evaluated", postgresql.JSONB, nullable=False),
        sa.Column("decision", sa.String(64), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column(
            "decided_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=True),
        sa.Column("entity_id", sa.Text, nullable=True),
        sa.Column("payload", postgresql.JSONB, nullable=True),
        sa.Column(
            "occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "rule_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("config", postgresql.JSONB, nullable=False),
        sa.Column("tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("test_result", postgresql.JSONB, nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "applied_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean, default=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    op.create_table(
        "batch_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submitted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("total_count", sa.Integer, nullable=False),
        sa.Column("processed_count", sa.Integer, default=0),
        sa.Column("failed_count", sa.Integer, default=0),
        sa.Column("status", sa.String(32), default="PROCESSING"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("batch_jobs")
    op.drop_table("rule_versions")
    op.drop_table("audit_log")
    op.drop_table("routing_decisions")
    op.drop_table("parcels")
    op.drop_table("users")
