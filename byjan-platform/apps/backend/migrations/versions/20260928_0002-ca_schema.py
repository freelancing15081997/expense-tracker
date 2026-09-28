"""CA schema

Revision ID: 003
Revises: 002
Create Date: 2026-09-28 00:02:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ca schema
    op.execute("CREATE SCHEMA IF NOT EXISTS ca")

    # Clients table
    op.create_table(
        'ca.clients',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('industry', sa.String(100), nullable=True),
        sa.Column('gstin', sa.String(255), nullable=True),
        sa.Column('pan_enc', sa.Text(), nullable=True),
        sa.Column('staff_id', sa.UUID(), nullable=True),
        sa.Column('fee_paise', sa.Integer(), default=0),
        sa.Column('client_tenant_id', sa.UUID(), nullable=True),
        sa.Column('health', sa.String(50), default='good'),
        sa.Column('books_status', sa.String(50), default='clean'),
        sa.Column('archived_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Compliance items table
    op.create_table(
        'ca.compliance_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('return_type', sa.String(50), nullable=False),
        sa.Column('group', sa.String(50), nullable=False),
        sa.Column('period', sa.String(10), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(50), default='Not started'),
        sa.Column('assignee_id', sa.UUID(), nullable=True),
        sa.Column('arn', sa.String(100), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Tasks table
    op.create_table(
        'ca.tasks',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assignee_id', sa.UUID(), nullable=True),
        sa.Column('due', sa.Date(), nullable=True),
        sa.Column('priority', sa.String(50), default='medium'),
        sa.Column('column', sa.String(50), default='todo'),
        sa.Column('position', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Review items table
    op.create_table(
        'ca.review_items',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('rule_key', sa.String(100), nullable=False),
        sa.Column('entity_ref', postgresql.JSONB(), nullable=True),
        sa.Column('issue', sa.Text(), nullable=False),
        sa.Column('suggested_fix', postgresql.JSONB(), nullable=True),
        sa.Column('amount_paise', sa.Integer(), default=0),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Team members table
    op.create_table(
        'ca.team_members',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('capacity_h', sa.Integer(), default=0),
        sa.Column('rate_paise', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Time entries table
    op.create_table(
        'ca.time_entries',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('staff_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('hours', sa.Numeric(5, 2), nullable=False),
        sa.Column('rate_paise', sa.Integer(), nullable=False),
        sa.Column('billable', sa.Boolean(), default=True),
        sa.Column('billed_invoice_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='ca'
    )

    # Create indexes
    op.create_index('ix_clients_tenant_id', 'ca.clients', ['tenant_id'])
    op.create_index('ix_clients_staff_id', 'ca.clients', ['staff_id'])
    op.create_index('ix_clients_health', 'ca.clients', ['health'])
    op.create_index('ix_clients_archived_at', 'ca.clients', ['archived_at'])

    op.create_index('ix_compliance_items_tenant_id', 'ca.compliance_items', ['tenant_id'])
    op.create_index('ix_compliance_items_client_id', 'ca.compliance_items', ['client_id'])
    op.create_index('ix_compliance_items_due_date', 'ca.compliance_items', ['due_date'])
    op.create_index('ix_compliance_items_status', 'ca.compliance_items', ['status'])

    op.create_index('ix_tasks_tenant_id', 'ca.tasks', ['tenant_id'])
    op.create_index('ix_tasks_client_id', 'ca.tasks', ['client_id'])
    op.create_index('ix_tasks_assignee_id', 'ca.tasks', ['assignee_id'])
    op.create_index('ix_tasks_column', 'ca.tasks', ['column'])
    op.create_index('ix_tasks_due', 'ca.tasks', ['due'])

    op.create_index('ix_review_items_tenant_id', 'ca.review_items', ['tenant_id'])
    op.create_index('ix_review_items_client_id', 'ca.review_items', ['client_id'])
    op.create_index('ix_review_items_status', 'ca.review_items', ['status'])

    op.create_index('ix_team_members_tenant_id', 'ca.team_members', ['tenant_id'])
    op.create_index('ix_team_members_user_id', 'ca.team_members', ['user_id'])

    op.create_index('ix_time_entries_tenant_id', 'ca.time_entries', ['tenant_id'])
    op.create_index('ix_time_entries_client_id', 'ca.time_entries', ['client_id'])
    op.create_index('ix_time_entries_staff_id', 'ca.time_entries', ['staff_id'])
    op.create_index('ix_time_entries_date', 'ca.time_entries', ['date'])
    op.create_index('ix_time_entries_billed', 'ca.time_entries', ['billed_invoice_id'])


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ca.ix_clients_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_clients_staff_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_clients_health")
    op.execute("DROP INDEX IF EXISTS ca.ix_clients_archived_at")
    op.execute("DROP INDEX IF EXISTS ca.ix_compliance_items_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_compliance_items_client_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_compliance_items_due_date")
    op.execute("DROP INDEX IF EXISTS ca.ix_compliance_items_status")
    op.execute("DROP INDEX IF EXISTS ca.ix_tasks_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_tasks_client_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_tasks_assignee_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_tasks_column")
    op.execute("DROP INDEX IF EXISTS ca.ix_tasks_due")
    op.execute("DROP INDEX IF EXISTS ca.ix_review_items_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_review_items_client_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_review_items_status")
    op.execute("DROP INDEX IF EXISTS ca.ix_team_members_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_team_members_user_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_time_entries_tenant_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_time_entries_client_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_time_entries_staff_id")
    op.execute("DROP INDEX IF EXISTS ca.ix_time_entries_date")
    op.execute("DROP INDEX IF EXISTS ca.ix_time_entries_billed")

    # Drop tables
    op.drop_table('ca.time_entries')
    op.drop_table('ca.team_members')
    op.drop_table('ca.review_items')
    op.drop_table('ca.tasks')
    op.drop_table('ca.compliance_items')
    op.drop_table('ca.clients')

    # Drop schema
    op.execute("DROP SCHEMA IF EXISTS ca")
