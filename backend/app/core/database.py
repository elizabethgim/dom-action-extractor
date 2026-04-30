import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import cast

from psycopg import Connection, connect
from psycopg.rows import DictRow, dict_row

from app.core.settings import DATABASE_URL

_CHART_NAMESPACE = uuid.UUID("7a5d8f4e-1b2c-4d6e-8a9b-0c3f5e7d9b1a")


def chart_slug_to_uuid(slug: str) -> str:
    return str(uuid.uuid5(_CHART_NAMESPACE, slug))


@contextmanager
def db_connection() -> Iterator[Connection[DictRow]]:
    connection = cast(Connection[DictRow], connect(DATABASE_URL, row_factory=dict_row))  # type: ignore[arg-type]

    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_database() -> None:
    with db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS charts (
              id UUID PRIMARY KEY,
              slug TEXT UNIQUE NOT NULL,
              title TEXT NOT NULL,
              source TEXT NOT NULL,
              family TEXT NOT NULL,
              renderer TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              dataset_id TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS chart_questions (
              id SERIAL PRIMARY KEY,
              chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
              question TEXT NOT NULL,
              sort_order INTEGER NOT NULL
            );
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_runs (
              id SERIAL PRIMARY KEY,
              chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE CASCADE,
              source TEXT NOT NULL,
              family TEXT NOT NULL,
              selected_question_index INTEGER NOT NULL DEFAULT 0,
              question_text TEXT NOT NULL,
              stop_reason TEXT,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_run_steps (
              id SERIAL PRIMARY KEY,
              run_id INTEGER NOT NULL REFERENCES ai_runs(id) ON DELETE CASCADE,
              step_index INTEGER NOT NULL,
              payload_json JSONB NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (run_id, step_index)
            );
            """
        )
