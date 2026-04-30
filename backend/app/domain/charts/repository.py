from psycopg.rows import DictRow

from app.core.database import db_connection, chart_slug_to_uuid
from app.domain.charts.registry import CHARTS
from app.domain.charts.schemas import ChartCreate, ChartDefinition


def seed_charts_if_empty() -> None:
    with db_connection() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM charts").fetchone()
        if row and row["count"] > 0:
            return

        for chart in CHARTS.values():
            chart_uuid = chart_slug_to_uuid(chart.id)
            connection.execute(
                """
                INSERT INTO charts (
                  id, slug, title, source, family, renderer, description, dataset_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    chart_uuid,
                    chart.id,
                    chart.title,
                    chart.source,
                    chart.family,
                    chart.renderer,
                    chart.description,
                    chart.dataset_id,
                ),
            )
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO chart_questions (chart_id, question, sort_order)
                    VALUES (%s, %s, %s)
                    """,
                    [
                        (chart_uuid, question, index)
                        for index, question in enumerate(chart.questions)
                    ],
                )


def _row_to_chart(row: DictRow, questions: list[str]) -> ChartDefinition:
    return ChartDefinition(
        id=str(row["slug"]),
        title=str(row["title"]),
        source=str(row["source"]),
        family=str(row["family"]),
        renderer=str(row["renderer"]),
        description=str(row["description"] or ""),
        dataset_id=str(row["dataset_id"]) if row["dataset_id"] is not None else None,
        questions=questions,
    )


def _questions_by_chart_uuid(chart_uuids: list[str]) -> dict[str, list[str]]:
    if not chart_uuids:
        return {}

    placeholders = ",".join("%s" for _ in chart_uuids)
    with db_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT chart_id, question
            FROM chart_questions
            WHERE chart_id IN ({placeholders})
            ORDER BY chart_id, sort_order
            """,
            tuple(chart_uuids),
        ).fetchall()

    questions: dict[str, list[str]] = {uuid: [] for uuid in chart_uuids}
    for row in rows:
        questions[str(row["chart_id"])].append(str(row["question"]))
    return questions


def list_chart_definitions() -> list[ChartDefinition]:
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, slug, title, source, family, renderer, description, dataset_id
            FROM charts
            ORDER BY source, family, title
            """
        ).fetchall()

    chart_uuids = [str(row["id"]) for row in rows]
    questions = _questions_by_chart_uuid(chart_uuids)
    return [_row_to_chart(row, questions.get(str(row["id"]), [])) for row in rows]


def create_chart_definition(data: ChartCreate) -> ChartDefinition:
    chart_uuid = chart_slug_to_uuid(data.slug)
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO charts (
              id, slug, title, source, family, renderer, description, dataset_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                chart_uuid,
                data.slug,
                data.title,
                data.source,
                data.family,
                data.renderer,
                data.description,
                data.dataset_id,
            ),
        )
        with connection.cursor() as cursor:
            cursor.executemany(
                """
                INSERT INTO chart_questions (chart_id, question, sort_order)
                VALUES (%s, %s, %s)
                """,
                [
                    (chart_uuid, q, i)
                    for i, q in enumerate(data.questions)
                    if q.strip()
                ],
            )
    return ChartDefinition(
        id=data.slug,
        title=data.title,
        source=data.source,
        family=data.family,
        renderer=data.renderer,
        description=data.description,
        dataset_id=data.dataset_id,
        questions=[q for q in data.questions if q.strip()],
    )


def get_chart_definition(chart_id: str) -> ChartDefinition | None:
    with db_connection() as connection:
        row = connection.execute(
            """
            SELECT id, slug, title, source, family, renderer, description, dataset_id
            FROM charts
            WHERE slug = %s
            """,
            (chart_id,),
        ).fetchone()

    if row is None:
        return None

    questions = _questions_by_chart_uuid([str(row["id"])])
    return _row_to_chart(row, questions.get(str(row["id"]), []))
