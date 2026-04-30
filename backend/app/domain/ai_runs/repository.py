import json

from psycopg.types.json import Jsonb

from app.core.database import db_connection
from app.domain.ai_runs.schemas import AiRunCreate, AiRunRead, AiRunStep


def create_ai_run(payload: AiRunCreate) -> AiRunRead:
    with db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO ai_runs (
              chart_id, source, family, selected_question_index, question_text, stop_reason
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                payload.chart_id,
                payload.source,
                payload.family,
                payload.selected_question_index,
                payload.question_text,
                payload.stop_reason,
            ),
        )
        row = cursor.fetchone()
        
        if row is None:
            raise RuntimeError("AI run insert did not return an id.")
        run_id = int(row["id"])

        with connection.cursor() as step_cursor:
            step_cursor.executemany(
                """
                INSERT INTO ai_run_steps (run_id, step_index, payload_json)
                VALUES (%s, %s, %s)
                """,
                [
                    (
                        run_id,
                        index,
                        Jsonb(step),
                    )
                    for index, step in enumerate(payload.steps)
                ],
            )

    run = get_ai_run(run_id)
    if run is None:
        raise RuntimeError("Saved AI run could not be loaded.")
    return run


def get_ai_run(run_id: int) -> AiRunRead | None:
    with db_connection() as connection:
        row = connection.execute(
            """
            SELECT
              id, source, family, chart_id, selected_question_index,
              question_text, stop_reason, created_at
            FROM ai_runs
            WHERE id = %s
            """,
            (run_id,),
        ).fetchone()

        if row is None:
            return None

        step_rows = connection.execute(
            """
            SELECT step_index, payload_json
            FROM ai_run_steps
            WHERE run_id = %s
            ORDER BY step_index
            """,
            (run_id,),
        ).fetchall()

    return AiRunRead(
        id=int(row["id"]),
        source=str(row["source"]),
        family=str(row["family"]),
        chartId=str(row["chart_id"]),
        selectedQuestionIndex=int(row["selected_question_index"]),
        questionText=str(row["question_text"]),
        stopReason=str(row["stop_reason"]) if row["stop_reason"] is not None else None,
        createdAt=str(row["created_at"]),
        steps=[
            AiRunStep(
                stepIndex=int(step["step_index"]),
                payload=(
                    step["payload_json"]
                    if isinstance(step["payload_json"], dict)
                    else json.loads(str(step["payload_json"]))
                ),
            )
            for step in step_rows
        ],
    )
