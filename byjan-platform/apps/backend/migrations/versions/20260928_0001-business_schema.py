"""Business schema

Revision ID: 002
Revises: 001
Create Date: 2026-09-28 00:01:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create biz schema
    op.execute("CREATE SCHEMA IF NOT EXISTS biz")

    # Accounts table
    op.create_table(
        'biz.accounts',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('group', sa.String(100), nullable=True),
        sa.Column('parent_id', sa.UUID(), nullable=True),
        sa.Column('is_bank', sa.Boolean(), default=False),
        sa.Column('is_system', sa.Boolean(), default=False),
        sa.Column('bank_meta_enc', sa.Text(), nullable=True),
        sa.Column('archived_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Periods table
    op.create_table(
        'biz.periods',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('fy', sa.String(10), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), default='open'),
        sa.Column('closed_by', sa.UUID(), nullable=True),
        sa.Column('closed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('locked_by', sa.UUID(), nullable=True),
        sa.Column('locked_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Journals table
    op.create_table(
        'biz.journals',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('source_type', sa.String(100), nullable=True),
        sa.Column('source_id', sa.UUID(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('narration', sa.Text(), default=''),
        sa.Column('posted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('reversed_by', sa.UUID(), nullable=True),
        sa.Column('reversed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # GL entries table (partitioned by month - will add partitioning separately)
    op.create_table(
        'biz.gl_entries',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('journal_id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('dr_paise', sa.Integer(), default=0),
        sa.Column('cr_paise', sa.Integer(), default=0),
        sa.Column('party_id', sa.UUID(), nullable=True),
        sa.Column('org_unit_id', sa.UUID(), nullable=True),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # GL balances table (projection)
    op.create_table(
        'biz.gl_balances',
        sa.Column('account_id', sa.UUID(), primary_key=True),
        sa.Column('period_id', sa.UUID(), primary_key=True),
        sa.Column('org_unit_id', sa.UUID(), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('dr', sa.Integer(), default=0),
        sa.Column('cr', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Parties table
    op.create_table(
        'biz.parties',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('gstin', sa.String(255), nullable=True),
        sa.Column('pan_enc', sa.Text(), nullable=True),
        sa.Column('state_code', sa.String(10), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('terms_days', sa.Integer(), default=30),
        sa.Column('category_id', sa.UUID(), nullable=True),
        sa.Column('group_name', sa.String(255), nullable=True),
        sa.Column('credit_limit', sa.Integer(), nullable=True),
        sa.Column('addresses', postgresql.JSONB(), nullable=True),
        sa.Column('opening_balance', sa.Integer(), default=0),
        sa.Column('archived_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Party categories table
    op.create_table(
        'biz.party_categories',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Party balances table (projection)
    op.create_table(
        'biz.party_balances',
        sa.Column('party_id', sa.UUID(), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('receivable', sa.Integer(), default=0),
        sa.Column('payable', sa.Integer(), default=0),
        sa.Column('overdue', sa.Integer(), default=0),
        sa.Column('oldest_due', sa.Date(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Items table
    op.create_table(
        'biz.items',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('unit', sa.String(50), nullable=True),
        sa.Column('hsn', sa.String(10), nullable=True),
        sa.Column('gst_rate', sa.Numeric(5, 4), nullable=True),
        sa.Column('sale_rate', sa.Integer(), nullable=True),
        sa.Column('purchase_rate', sa.Integer(), nullable=True),
        sa.Column('reorder_level', sa.Numeric(18, 3), nullable=True),
        sa.Column('track_stock', sa.Boolean(), default=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Locations table
    op.create_table(
        'biz.locations',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Stock moves table
    op.create_table(
        'biz.stock_moves',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('location_id', sa.UUID(), nullable=False),
        sa.Column('qty', sa.Numeric(18, 3), nullable=False),
        sa.Column('cost_paise', sa.Integer(), nullable=False),
        sa.Column('source_type', sa.String(100), nullable=True),
        sa.Column('source_id', sa.UUID(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Stock levels table (projection)
    op.create_table(
        'biz.stock_levels',
        sa.Column('item_id', sa.UUID(), primary_key=True),
        sa.Column('location_id', sa.UUID(), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('on_hand', sa.Numeric(18, 3), default=0),
        sa.Column('avg_cost', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Documents table (14 types)
    op.create_table(
        'biz.documents',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('number', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), default='Draft'),
        sa.Column('party_id', sa.UUID(), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('terms_days', sa.Integer(), default=30),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('salesperson_id', sa.UUID(), nullable=True),
        sa.Column('project_id', sa.UUID(), nullable=True),
        sa.Column('org_unit_id', sa.UUID(), nullable=True),
        sa.Column('tax_mode', sa.String(50), default='exclusive'),
        sa.Column('place_of_supply', sa.String(10), nullable=True),
        sa.Column('totals', postgresql.JSONB(), nullable=True),
        sa.Column('paid_paise', sa.Integer(), default=0),
        sa.Column('balance_paise', sa.Integer(), default=0),
        sa.Column('options', postgresql.JSONB(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('narration', sa.Text(), nullable=True),
        sa.Column('recurring', postgresql.JSONB(), nullable=True),
        sa.Column('source_doc_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Document lines table
    op.create_table(
        'biz.document_lines',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('document_id', sa.UUID(), nullable=False),
        sa.Column('position', sa.Integer(), default=0),
        sa.Column('item_id', sa.UUID(), nullable=True),
        sa.Column('account_id', sa.UUID(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('hsn', sa.String(10), nullable=True),
        sa.Column('qty', sa.Numeric(18, 3), default=0),
        sa.Column('rate_paise', sa.Integer(), default=0),
        sa.Column('discount_pct', sa.Numeric(5, 4), default=0),
        sa.Column('gst_rate', sa.Numeric(5, 4), nullable=True),
        sa.Column('amount_paise', sa.Integer(), default=0),
        sa.Column('dr_paise', sa.Integer(), default=0),
        sa.Column('cr_paise', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Payments table
    op.create_table(
        'biz.payments',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('direction', sa.String(10), nullable=False),
        sa.Column('party_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('mode', sa.String(50), default='bank'),
        sa.Column('account_id', sa.UUID(), nullable=True),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), default='posted'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Payment allocations table
    op.create_table(
        'biz.payment_allocations',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('payment_id', sa.UUID(), nullable=False),
        sa.Column('document_id', sa.UUID(), nullable=False),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('tds_paise', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Payment runs table
    op.create_table(
        'biz.payment_runs',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(50), default='draft'),
        sa.Column('approver_id', sa.UUID(), nullable=True),
        sa.Column('bank_file_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Bank connections table
    op.create_table(
        'biz.bank_connections',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('provider', sa.String(100), nullable=False),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('consent_expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Bank lines table
    op.create_table(
        'biz.bank_lines',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text(), default=''),
        sa.Column('amount_paise', sa.Integer(), nullable=False),
        sa.Column('balance_paise', sa.Integer(), nullable=False),
        sa.Column('ext_id', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), default='unmatched'),
        sa.Column('matched', postgresql.JSONB(), nullable=True),
        sa.Column('rule_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Bank rules table
    op.create_table(
        'biz.bank_rules',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('match', postgresql.JSONB(), nullable=False),
        sa.Column('action', postgresql.JSONB(), nullable=False),
        sa.Column('priority', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Assets table
    op.create_table(
        'biz.assets',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('acquired_on', sa.Date(), nullable=False),
        sa.Column('cost', sa.Integer(), nullable=False),
        sa.Column('rate_pct', sa.Numeric(5, 2), nullable=False),
        sa.Column('method', sa.String(50), default='straight-line'),
        sa.Column('accumulated', sa.Integer(), default=0),
        sa.Column('status', sa.String(50), default='in-use'),
        sa.Column('disposed_on', sa.Date(), nullable=True),
        sa.Column('proceeds_paise', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Projects table
    op.create_table(
        'biz.projects',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('budget', postgresql.JSONB(), nullable=True),
        sa.Column('spent', sa.Integer(), default=0),
        sa.Column('invoiced', sa.Integer(), default=0),
        sa.Column('margin', sa.Numeric(5, 2), nullable=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Budgets table
    op.create_table(
        'biz.budgets',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('fy', sa.String(10), nullable=False),
        sa.Column('account_id', sa.UUID(), nullable=False),
        sa.Column('org_unit_id', sa.UUID(), nullable=True),
        sa.Column('months', postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Tax returns table
    op.create_table(
        'biz.tax_returns',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('period', sa.String(10), nullable=False),
        sa.Column('status', sa.String(50), default='draft'),
        sa.Column('working', postgresql.JSONB(), nullable=True),
        sa.Column('arn', sa.String(100), nullable=True),
        sa.Column('filed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Approvals table
    op.create_table(
        'biz.approvals',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('source_type', sa.String(100), nullable=False),
        sa.Column('source_id', sa.UUID(), nullable=False),
        sa.Column('amount_paise', sa.Integer(), default=0),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('requested_by', sa.UUID(), nullable=False),
        sa.Column('approver_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(50), default='pending'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='biz'
    )

    # Create indexes for performance
    op.create_index('ix_accounts_tenant_id', 'biz.accounts', ['tenant_id'])
    op.create_index('ix_accounts_code', 'biz.accounts', ['code'])
    op.create_index('ix_accounts_type', 'biz.accounts', ['type'])
    op.create_index('ix_accounts_archived_at', 'biz.accounts', ['archived_at'])

    op.create_index('ix_periods_tenant_id', 'biz.periods', ['tenant_id'])
    op.create_index('ix_periods_fy_month', 'biz.periods', ['tenant_id', 'fy', 'month'], unique=True)
    op.create_index('ix_periods_status', 'biz.periods', ['status'])

    op.create_index('ix_journals_tenant_id', 'biz.journals', ['tenant_id'])
    op.create_index('ix_journals_date', 'biz.journals', ['date'])
    op.create_index('ix_journals_source', 'biz.journals', ['source_type', 'source_id'])

    op.create_index('ix_gl_entries_tenant_id', 'biz.gl_entries', ['tenant_id'])
    op.create_index('ix_gl_entries_journal_id', 'biz.gl_entries', ['journal_id'])
    op.create_index('ix_gl_entries_account_id', 'biz.gl_entries', ['account_id'])
    op.create_index('ix_gl_entries_tenant_account_date', 'biz.gl_entries', ['tenant_id', 'account_id', 'date'])

    op.create_index('ix_gl_balances_tenant_id', 'biz.gl_balances', ['tenant_id'])
    op.create_index('ix_gl_balances_account_id', 'biz.gl_balances', ['account_id'])
    op.create_index('ix_gl_balances_period_id', 'biz.gl_balances', ['period_id'])

    op.create_index('ix_parties_tenant_id', 'biz.parties', ['tenant_id'])
    op.create_index('ix_parties_kind', 'biz.parties', ['kind'])
    op.create_index('ix_parties_name', 'biz.parties', ['name'])
    op.create_index('ix_parties_gstin', 'biz.parties', ['gstin'])
    op.create_index('ix_parties_archived_at', 'biz.parties', ['archived_at'])

    op.create_index('ix_party_categories_tenant_id', 'biz.party_categories', ['tenant_id'])
    op.create_index('ix_party_categories_kind', 'biz.party_categories', ['kind'])

    op.create_index('ix_party_balances_tenant_id', 'biz.party_balances', ['tenant_id'])
    op.create_index('ix_party_balances_party_id', 'biz.party_balances', ['party_id'])

    op.create_index('ix_items_tenant_id', 'biz.items', ['tenant_id'])
    op.create_index('ix_items_sku', 'biz.items', ['sku'])
    op.create_index('ix_items_type', 'biz.items', ['type'])
    op.create_index('ix_items_hsn', 'biz.items', ['hsn'])

    op.create_index('ix_locations_tenant_id', 'biz.locations', ['tenant_id'])
    op.create_index('ix_locations_name', 'biz.locations', ['name'])

    op.create_index('ix_stock_moves_tenant_id', 'biz.stock_moves', ['tenant_id'])
    op.create_index('ix_stock_moves_item_id', 'biz.stock_moves', ['item_id'])
    op.create_index('ix_stock_moves_location_id', 'biz.stock_moves', ['location_id'])
    op.create_index('ix_stock_moves_date', 'biz.stock_moves', ['date'])

    op.create_index('ix_stock_levels_tenant_id', 'biz.stock_levels', ['tenant_id'])
    op.create_index('ix_stock_levels_item_id', 'biz.stock_levels', ['item_id'])

    op.create_index('ix_documents_tenant_id', 'biz.documents', ['tenant_id'])
    op.create_index('ix_documents_type', 'biz.documents', ['type'])
    op.create_index('ix_documents_number', 'biz.documents', ['number'])
    op.create_index('ix_documents_tenant_type', 'biz.documents', ['tenant_id', 'type'])
    op.create_index('ix_documents_status', 'biz.documents', ['status'])
    op.create_index('ix_documents_date', 'biz.documents', ['date'])
    op.create_index('ix_documents_party_id', 'biz.documents', ['party_id'])

    op.create_index('ix_document_lines_document_id', 'biz.document_lines', ['document_id'])
    op.create_index('ix_document_lines_position', 'biz.document_lines', ['document_id', 'position'])

    op.create_index('ix_payments_tenant_id', 'biz.payments', ['tenant_id'])
    op.create_index('ix_payments_party_id', 'biz.payments', ['party_id'])
    op.create_index('ix_payments_date', 'biz.payments', ['date'])
    op.create_index('ix_payments_status', 'biz.payments', ['status'])

    op.create_index('ix_payment_allocations_payment_id', 'biz.payment_allocations', ['payment_id'])
    op.create_index('ix_payment_allocations_document_id', 'biz.payment_allocations', ['document_id'])

    op.create_index('ix_payment_runs_tenant_id', 'biz.payment_runs', ['tenant_id'])
    op.create_index('ix_payment_runs_status', 'biz.payment_runs', ['status'])

    op.create_index('ix_bank_connections_tenant_id', 'biz.bank_connections', ['tenant_id'])
    op.create_index('ix_bank_connections_account_id', 'biz.bank_connections', ['account_id'])

    op.create_index('ix_bank_lines_tenant_id', 'biz.bank_lines', ['tenant_id'])
    op.create_index('ix_bank_lines_account_id', 'biz.bank_lines', ['account_id'])
    op.create_index('ix_bank_lines_date', 'biz.bank_lines', ['date'])
    op.create_index('ix_bank_lines_status', 'biz.bank_lines', ['status'])
    op.create_index('ix_bank_lines_ext_id', 'biz.bank_lines', ['ext_id'], unique=True)

    op.create_index('ix_bank_rules_tenant_id', 'biz.bank_rules', ['tenant_id'])
    op.create_index('ix_bank_rules_priority', 'biz.bank_rules', ['priority'])

    op.create_index('ix_assets_tenant_id', 'biz.assets', ['tenant_id'])
    op.create_index('ix_assets_category', 'biz.assets', ['category'])
    op.create_index('ix_assets_status', 'biz.assets', ['status'])

    op.create_index('ix_projects_tenant_id', 'biz.projects', ['tenant_id'])
    op.create_index('ix_projects_status', 'biz.projects', ['status'])

    op.create_index('ix_budgets_tenant_id', 'biz.budgets', ['tenant_id'])
    op.create_index('ix_budgets_fy', 'biz.budgets', ['fy'])
    op.create_index('ix_budgets_account_id', 'biz.budgets', ['account_id'])

    op.create_index('ix_tax_returns_tenant_id', 'biz.tax_returns', ['tenant_id'])
    op.create_index('ix_tax_returns_period', 'biz.tax_returns', ['period'])
    op.create_index('ix_tax_returns_status', 'biz.tax_returns', ['status'])

    op.create_index('ix_approvals_tenant_id', 'biz.approvals', ['tenant_id'])
    op.create_index('ix_approvals_source', 'biz.approvals', ['source_type', 'source_id'])
    op.create_index('ix_approvals_status', 'biz.approvals', ['status'])
    op.create_index('ix_approvals_requested_by', 'biz.approvals', ['requested_by'])


def downgrade() -> None:
    # Drop indexes
    for table in ['accounts', 'periods', 'journals', 'gl_entries', 'gl_balances',
                   'parties', 'party_categories', 'party_balances', 'items', 'locations',
                   'stock_moves', 'stock_levels', 'documents', 'document_lines',
                   'payments', 'payment_allocations', 'payment_runs', 'bank_connections',
                   'bank_lines', 'bank_rules', 'assets', 'projects', 'budgets',
                   'tax_returns', 'approvals']:
        op.execute(f"DROP INDEX IF EXISTS biz.ix_{table}_tenant_id")
        op.execute(f"DROP INDEX IF EXISTS biz.ix_{table}_status")
        # ... (drop all other indexes)

    # Drop tables
    op.drop_table('biz.approvals')
    op.drop_table('biz.tax_returns')
    op.drop_table('biz.budgets')
    op.drop_table('biz.projects')
    op.drop_table('biz.assets')
    op.drop_table('biz.bank_rules')
    op.drop_table('biz.bank_lines')
    op.drop_table('biz.bank_connections')
    op.drop_table('biz.payment_runs')
    op.drop_table('biz.payment_allocations')
    op.drop_table('biz.payments')
    op.drop_table('biz.document_lines')
    op.drop_table('biz.documents')
    op.drop_table('biz.stock_levels')
    op.drop_table('biz.stock_moves')
    op.drop_table('biz.locations')
    op.drop_table('biz.items')
    op.drop_table('biz.party_balances')
    op.drop_table('biz.party_categories')
    op.drop_table('biz.parties')
    op.drop_table('biz.gl_balances')
    op.drop_table('biz.gl_entries')
    op.drop_table('biz.journals')
    op.drop_table('biz.periods')
    op.drop_table('biz.accounts')

    # Drop schema
    op.execute("DROP SCHEMA IF EXISTS biz")
