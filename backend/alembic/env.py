import os
import sys
from logging.config import fileConfig
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

sys.path.append(str(Path(__file__).resolve().parents[1]))
load_dotenv()

from app.models import Base  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sanitized_database_url() -> str:
    # Strip query params (e.g. Prisma's `?schema=public`) that psycopg2 doesn't understand.
    parts = urlsplit(os.environ["DATABASE_URL"])
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


config.set_main_option("sqlalchemy.url", _sanitized_database_url())


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
