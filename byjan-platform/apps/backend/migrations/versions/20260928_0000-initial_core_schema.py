"""Initial core schema

Revision ID: 001
Revises: 
Create Date: 2026-09-28 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create core schema
    op.execute("CREATE SCHEMA IF NOT EXISTS core")
    op.execute("CREATE SCHEMA IF NOT EXISTS biz")
    op.execute("CREATE SCHEMA IF NOT EXISTS ca")
    op.execute("CREATE SCHEMA IF NOT EXISTS console")

    # Enable UUID extension
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # Core tables
    op.create_table(
        'core.users',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('firebase_uid', sa.String(255), unique=True, nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=True),
        sa.Column('phone_enc', sa.String(255), nullable=True),
        sa.Column('phone_bidx', sa.String(255), unique=True, nullable=True),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('lang', sa.String(10), default='en'),
        sa.Column('ui', postgresql.JSONB(), nullable=True),
        sa.Column('sup', sa.Boolean(), default=False),
        sa.Column('mfa_secret_enc', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='core'
    )

    op.create_table(
        'core.tenants',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('kind', sa.String(50), nullable=False),  # business, practice, dhani
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('legal', postgresql.JSONB(), nullable=True),
        sa.Column('gstin', sa.String(255), nullable=True),
        sa.Column('state_code', sa.String(10), nullable=True),
        sa.Column('fy_start_month', sa.Integer(), default=4),  # April
        sa.Column('lang', sa.String(10), default='en'),
        sa.Column('settings', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='core'
    )

    op.create_table(
        'core.memberships',
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=True),
        sa.Column('kind', sa.String(50), default='member'),  # member, ca
        sa.Column('org_unit_ids', postgresql.ARRAY(sa.UUID()), nullable=True),
        sa.Column('status', sa.String(50), default='active'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('tenant_id', 'user_id', name='memberships_pk'),
        schema='core'
    )

    op.create_table(
        'core.roles',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('system', sa.Boolean(), default=False),
        sa.Column('locked', sa.Boolean(), default=False),
        sa.Column('limits', postgresql.JSONB(), nullable=True),
        sa.Column('perm_version', sa.Integer(), default=1),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), onupdate=sa.text('NOW()'), nullable=False),
        schema='core'
    )

    op.create_table(
        'core.role_permissions',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('module', sa.String(100), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('allowed', sa.Boolean(), default=True),
        sa.PrimaryKeyConstraint('role_id', 'module', 'action', name='role_permissions_pk'),
        schema='core'
    )

    op.create_table(
        'core.sessions',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('family_id', sa.UUID(), nullable=True),
        sa.Column('refresh_hash', sa.String(255), unique=True, nullable=False),
        sa.Column('device', sa.String(255), nullable=True),
        sa.Column('ip', sa.String(50), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('ua', sa.String(500), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('last_seen_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('ver', sa.Integer(), default=1),
        schema='core'
    )

    op.create_table(
        'core.audit_log',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('actor_id', sa.UUID(), nullable=False),
        sa.Column('act_as', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('diff', postgresql.JSONB(), nullable=True),
        sa.Column('ip', sa.String(50), nullable=True),
        sa.Column('ua', sa.String(500), nullable=True),
        sa.Column('request_id', sa.String(100), nullable=True),
        sa.Column('prev_hash', sa.String(255), nullable=True),
        sa.Column('hash', sa.String(255), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        # Partition by month (will be added in separate migration)
        schema='core'
    )

    op.create_table(
        'core.outbox',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('published_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('attempts', sa.Integer(), default=0),
        sa.Column('last_error', sa.Text(), nullable=True),
        schema='core'
    )

    op.create_index('ix_core_outbox_published_at', 'core.outbox', ['published_at'], unique=False, postgresql_where=sa.text('published_at IS NULL'))

    op.create_table(
        'core.console_issues',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v7()'), primary_key=True),
        sa.Column('sev', sa.String(20), nullable=False),  # critical, warning, info
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('module', sa.String(100), nullable=True),
        sa.Column('tenant_id', sa.UUID(), nullable=True),
        sa.Column('occurrences', sa.Integer(), default=1),
        sa.Column('first_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('last_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('status', sa.String(50), default='open'),
        sa.Column('trace_ids', postgresql.ARRAY(sa.String()), nullable=True),
        schema='core'
    )

    # Create indexes
    op.create_index('ix_core_users_firebase_uid', 'core.users', ['firebase_uid'], unique=True)
    op.create_index('ix_core_users_email', 'core.users', ['email'], unique=True)
    op.create_index('ix_core_tenants_kind', 'core.tenants', ['kind'])
    op.create_index('ix_core_memberships_user_id', 'core.memberships', ['user_id'])
    op.create_index('ix_core_memberships_role_id', 'core.memberships', ['role_id'])
    op.create_index('ix_core_roles_tenant_id', 'core.roles', ['tenant_id'])
    op.create_index('ix_core_sessions_user_id', 'core.sessions', ['user_id'])
    op.create_index('ix_core_sessions_family_id', 'core.sessions', ['family_id'])
    op.create_index('ix_core_audit_log_tenant_id', 'core.audit_log', ['tenant_id'])
    op.create_index('ix_core_audit_log_actor_id', 'core.audit_log', ['actor_id'])
    op.create_index('ix_core_audit_log_created_at', 'core.audit_log', ['created_at'])
    op.create_index('ix_core_outbox_tenant_id', 'core.outbox', ['tenant_id'])
    op.create_index('ix_core_console_issues_tenant_id', 'core.console_issues', ['tenant_id'])
    op.create_index('ix_core_console_issues_status', 'core.console_issues', ['status'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_core_console_issues_status', schema='core')
    op.drop_index('ix_core_console_issues_tenant_id', schema='core')
    op.drop_index('ix_core_outbox_tenant_id', schema='core')
    op.drop_index('ix_core_audit_log_created_at', schema='core')
    op.drop_index('ix_core_audit_log_actor_id', schema='core')
    op.drop_index('ix_core_audit_log_tenant_id', schema='core')
    op.drop_index('ix_core_sessions_family_id', schema='core')
    op.drop_index('ix_core_sessions_user_id', schema='core')
    op.drop_index('ix_core_roles_tenant_id', schema='core')
    op.drop_index('ix_core_memberships_role_id', schema='core')
    op.drop_index('ix_core_memberships_user_id', schema='core')
    op.drop_index('ix_core_tenants_kind', schema='core')
    op.drop_index('ix_core_users_email', schema='core')
    op.drop_index('ix_core_users_firebase_uid', schema='core')

    # Drop tables
    op.drop_table('core.console_issues')
    op.drop_table('core.outbox')
    op.drop_table('core.audit_log')
    op.drop_table('core.sessions')
    op.drop_table('core.role_permissions')
    op.drop_table('core.roles')
    op.drop_table('core.memberships')
    op.drop_table('core.tenants')
    op.drop_table('core.users')

    # Drop schemas
    op.execute("DROP SCHEMA IF EXISTS console")
    op.execute("DROP SCHEMA IF EXISTS ca")
    op.execute("DROP SCHEMA IF EXISTS biz")
    op.execute("DROP SCHEMA IF EXISTS core")

    # Drop extension
    op.execute("DROP EXTENSION IF EXISTS \"uuid-ossp\"")
