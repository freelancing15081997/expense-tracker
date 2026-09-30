"""Enable Postgres RLS on core business tables (tenant isolation).

Revision ID: 005
Revises: 004
Create Date: 2026-09-30
"""
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

# Tables that always carry tenant_id and must never leak across tenants.
BIZ_TABLES = (
    "parties",
    "documents",
    "payments",
    "accounts",
    "items",
)


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS biz")
    for table in BIZ_TABLES:
        op.execute(f'ALTER TABLE IF EXISTS biz."{table}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE IF EXISTS biz."{table}" FORCE ROW LEVEL SECURITY')
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation ON biz."{table}"')
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON biz."{table}"
            USING (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
            WITH CHECK (tenant_id::text = NULLIF(current_setting('app.tenant_id', true), ''))
            """
        )

    # Membership lookups stay app-filtered; RLS on memberships still helps.
    op.execute("ALTER TABLE IF EXISTS core.memberships ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE IF EXISTS core.memberships FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS membership_tenant_isolation ON core.memberships")
    op.execute(
        """
        CREATE POLICY membership_tenant_isolation ON core.memberships
        USING (
          tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
          OR user_id::text = NULLIF(current_setting('app.user_id', true), '')
        )
        """
    )


def downgrade() -> None:
    for table in BIZ_TABLES:
        op.execute(f'DROP POLICY IF EXISTS tenant_isolation ON biz."{table}"')
        op.execute(f'ALTER TABLE IF EXISTS biz."{table}" DISABLE ROW LEVEL SECURITY')
    op.execute("DROP POLICY IF EXISTS membership_tenant_isolation ON core.memberships")
    op.execute("ALTER TABLE IF EXISTS core.memberships DISABLE ROW LEVEL SECURITY")
