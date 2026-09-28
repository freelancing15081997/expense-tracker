"""Console schema

Revision ID: 004
Revises: 003
Create Date: 2026-09-28 00:03:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create console schema
    op.execute("CREATE SCHEMA IF NOT EXISTS console")

    # Console issues table (already created in core, but keeping for schema completeness)
    # The actual table is in core schema - see migration 001


def downgrade() -> None:
    # Drop schema
    op.execute("DROP SCHEMA IF EXISTS console")
