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

    # UUID v7 lives in the core schema so public stays untouched.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION core.uuid_generate_v7() RETURNS uuid
        AS $$
        DECLARE
          unix_ts_ms bytea;
          uuid_bytes bytea;
        BEGIN
          unix_ts_ms = substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3);
          uuid_bytes = unix_ts_ms || gen_random_bytes(10);
          uuid_bytes = set_byte(uuid_bytes, 6, (b'0111' || get_byte(uuid_bytes, 6)::bit(4))::bit(8)::int);
          uuid_bytes = set_byte(uuid_bytes, 8, (b'10' || get_byte(uuid_bytes, 8)::bit(6))::bit(8)::int);
          RETURN encode(uuid_bytes, 'hex')::uuid;
        END
        $$ LANGUAGE plpgsql VOLATILE
        """
    )

    # Core tables
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
        'tenants',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
        'memberships',
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
        'roles',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
        'role_permissions',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('module', sa.String(100), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('allowed', sa.Boolean(), default=True),
        sa.PrimaryKeyConstraint('role_id', 'module', 'action', name='role_permissions_pk'),
        schema='core'
    )

    op.create_table(
        'sessions',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
        'audit_log',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
        'outbox',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('published_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('attempts', sa.Integer(), default=0),
        sa.Column('last_error', sa.Text(), nullable=True),
        schema='core'
    )

    op.create_index('ix_core_outbox_published_at', 'outbox', ['published_at'], unique=False, postgresql_where=sa.text('published_at IS NULL'), schema='core')

    op.create_table(
        'console_issues',
        sa.Column('id', sa.UUID(), server_default=sa.text('core.uuid_generate_v7()'), primary_key=True),
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
    op.create_index('ix_core_users_firebase_uid', 'users', ['firebase_uid'], unique=True, schema='core')
    op.create_index('ix_core_users_email', 'users', ['email'], unique=True, schema='core')
    op.create_index('ix_core_tenants_kind', 'tenants', ['kind'], schema='core')
    op.create_index('ix_core_memberships_user_id', 'memberships', ['user_id'], schema='core')
    op.create_index('ix_core_memberships_role_id', 'memberships', ['role_id'], schema='core')
    op.create_index('ix_core_roles_tenant_id', 'roles', ['tenant_id'], schema='core')
    op.create_index('ix_core_sessions_user_id', 'sessions', ['user_id'], schema='core')
    op.create_index('ix_core_sessions_family_id', 'sessions', ['family_id'], schema='core')
    op.create_index('ix_core_audit_log_tenant_id', 'audit_log', ['tenant_id'], schema='core')
    op.create_index('ix_core_audit_log_actor_id', 'audit_log', ['actor_id'], schema='core')
    op.create_index('ix_core_audit_log_created_at', 'audit_log', ['created_at'], schema='core')
    op.create_index('ix_core_outbox_tenant_id', 'outbox', ['tenant_id'], schema='core')
    op.create_index('ix_core_console_issues_tenant_id', 'console_issues', ['tenant_id'], schema='core')
    op.create_index('ix_core_console_issues_status', 'console_issues', ['status'], schema='core')


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
    op.drop_table('console_issues', schema='core')
    op.drop_table('outbox', schema='core')
    op.drop_table('audit_log', schema='core')
    op.drop_table('sessions', schema='core')
    op.drop_table('role_permissions', schema='core')
    op.drop_table('roles', schema='core')
    op.drop_table('memberships', schema='core')
    op.drop_table('tenants', schema='core')
    op.drop_table('users', schema='core')

    op.execute("DROP FUNCTION IF EXISTS core.uuid_generate_v7()")

    # Drop schemas
    op.execute("DROP SCHEMA IF EXISTS console")
    op.execute("DROP SCHEMA IF EXISTS ca")
    op.execute("DROP SCHEMA IF EXISTS biz")
    op.execute("DROP SCHEMA IF EXISTS core")

    # Leave extensions in place. This database is shared with the live app.
