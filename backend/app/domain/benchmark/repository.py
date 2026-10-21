from app.core.database import db_connection
from app.domain.benchmark.schemas import BenchmarkEpisodeCreate, BenchmarkEpisodeRead

_SELECT_JOINED = """
    SELECT
      b.id, b.run_id, b.answer, b.question_type, b.structural_complexity,
      b.interaction_complexity, b.reasoning_complexity, b.notes, b.created_at,
      r.chart_id, r.source, r.family, r.question_text,
      COUNT(s.id) AS step_count
    FROM benchmark_episodes b
    JOIN ai_runs r ON r.id = b.run_id
    LEFT JOIN ai_run_steps s ON s.run_id = r.id
"""


def _row_to_episode(row: dict) -> BenchmarkEpisodeRead:
    return BenchmarkEpisodeRead(
        id=str(row["id"]),
        runId=str(row["run_id"]),
        answer=str(row["answer"]),
        questionType=str(row["question_type"]),
        structuralComplexity=str(row["structural_complexity"]),
        interactionComplexity=str(row["interaction_complexity"]),
        reasoningComplexity=str(row["reasoning_complexity"]),
        notes=str(row["notes"]),
        createdAt=str(row["created_at"]),
        chartId=str(row["chart_id"]),
        source=str(row["source"]),
        family=str(row["family"]),
        questionText=str(row["question_text"]),
        stepCount=int(row["step_count"]),
    )


def create_benchmark_episode(payload: BenchmarkEpisodeCreate) -> BenchmarkEpisodeRead:
    with db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO benchmark_episodes (
              run_id, answer, question_type, structural_complexity,
              interaction_complexity, reasoning_complexity, notes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                payload.run_id,
                payload.answer,
                payload.question_type,
                payload.structural_complexity,
                payload.interaction_complexity,
                payload.reasoning_complexity,
                payload.notes,
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("Benchmark episode insert did not return an id.")
        episode_id = str(row["id"])

    episode = get_benchmark_episode(episode_id)
    if episode is None:
        raise RuntimeError("Saved benchmark episode could not be loaded.")
    return episode


def get_benchmark_episode(episode_id: str) -> BenchmarkEpisodeRead | None:
    with db_connection() as connection:
        row = connection.execute(
            f"""
            {_SELECT_JOINED}
            WHERE b.id = %s
            GROUP BY b.id, r.chart_id, r.source, r.family, r.question_text
            """,
            (episode_id,),
        ).fetchone()

    return _row_to_episode(row) if row is not None else None


def list_benchmark_episodes() -> list[BenchmarkEpisodeRead]:
    with db_connection() as connection:
        rows = connection.execute(
            f"""
            {_SELECT_JOINED}
            GROUP BY b.id, r.chart_id, r.source, r.family, r.question_text
            ORDER BY b.created_at DESC
            """
        ).fetchall()

    return [_row_to_episode(row) for row in rows]
