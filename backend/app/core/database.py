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
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              chart_id UUID NOT NULL REFERENCES charts(id) ON DELETE RESTRICT,
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
            ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS expected_answer TEXT;
            ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS grade TEXT;
            ALTER TABLE ai_runs ADD COLUMN IF NOT EXISTS pipeline_variant TEXT NOT NULL DEFAULT 'baseline';
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS ai_run_steps (
              id SERIAL PRIMARY KEY,
              run_id UUID NOT NULL REFERENCES ai_runs(id) ON DELETE RESTRICT,
              step_index INTEGER NOT NULL,
              payload_json JSONB NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (run_id, step_index)
            );
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS benchmark_episodes (
              id SERIAL PRIMARY KEY,
              run_id UUID NOT NULL UNIQUE REFERENCES ai_runs(id) ON DELETE RESTRICT,
              answer TEXT NOT NULL,
              question_type TEXT NOT NULL
                CHECK (question_type IN ('exact_value_lookup', 'comparison', 'hierarchical_reveal')),
              structural_complexity TEXT NOT NULL
                CHECK (structural_complexity IN ('flat', 'hierarchical')),
              interaction_complexity TEXT NOT NULL
                CHECK (interaction_complexity IN ('low', 'high')),
              reasoning_complexity TEXT NOT NULL
                CHECK (reasoning_complexity IN ('single_step', 'multi_step')),
              notes TEXT NOT NULL DEFAULT '',
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS chart_codes (
              id SERIAL PRIMARY KEY,
              title TEXT NOT NULL,
              html_code TEXT NOT NULL DEFAULT '',
              css_code TEXT NOT NULL DEFAULT '',
              js_code TEXT NOT NULL DEFAULT '',
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
