"""parcel_id_counters table for atomic sequence generation

Revision ID: 002
Revises: 001
Create Date: 2026-05-26
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "parcel_id_counters",
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("seq", sa.Integer, nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("country", "day"),
    )


def downgrade():
    op.drop_table("parcel_id_counters")
