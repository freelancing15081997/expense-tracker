"""
Alembic environment configuration
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, text
from alembic import context
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.settings import settings
from app.shared.ids import UUIDv7

# Import all ORM models to ensure they're registered
# TODO: Import ORM models when created
# from app.platform.infra.orm import *
# from app.business.infra.orm import *
# from app.ca.infra.orm import *

# Alembic Config object
config = context.config

# Override sqlalchemy.url from settings
sync_url = (
    settings.DATABASE_URL
    .replace("postgresql+asyncpg://", "postgresql+psycopg://")
    .replace("ssl=require", "sslmode=require")
)
if sync_url.startswith("postgresql://"):
    sync_url = "postgresql+psycopg://" + sync_url[len("postgresql://"):]
config.set_main_option("sqlalchemy.url", sync_url.replace("%", "%%"))

# Interpret the config file for Python logging
if config.config_file_name is not None and config.file_config.has_section("formatters"):
    fileConfig(config.config_file_name)

# Target metadata for autogenerate support
target_metadata = None  # TODO: Set to Base.metadata when ORM models are created


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        version_table_schema="core",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Keep Alembic's version table out of public, beside the platform tables.
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS core"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            version_table_schema="core",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
