import os
from urllib.parse import urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


def _sanitized_database_url() -> str:
  # Strip query params (e.g. Prisma's `?schema=public`) that psycopg2 doesn't understand.
  parts = urlsplit(os.environ["DATABASE_URL"])
  return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


engine = create_engine(_sanitized_database_url())
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
  pass


def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
