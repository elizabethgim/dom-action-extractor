from app.core.database import db_connection
from app.domain.chart_codes.schemas import ChartCodeCreate, ChartCodeRead

def create_chart_code(payload: ChartCodeCreate) -> ChartCodeRead:
    with db_connection() as connection:
        row = connection.execute(
            """
            INSERT INTO chart_codes (title, html_code, css_code, js_code)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, html_code, css_code, js_code
            """,
            (
                payload.title, 
                payload.html_code,
                payload.css_code,
                payload.js_code,
            ),
        ).fetchone()
    return ChartCodeRead(**row)


def list_chart_codes() -> list[ChartCodeRead]:
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, html_code, css_code, js_code
            FROM chart_codes
            ORDER BY id DESC
            """
        ).fetchall()
    return [ChartCodeRead(**row) for row in rows]


def get_chart_code(chart_id: int) -> ChartCodeRead:
    with db_connection() as connection:
        cursor = connection.execute(
            """
            SELECT id, title, html_code, css_code, js_code
            FROM chart_codes
            WHERE id = %s
            """,
            (chart_id,),
        )

        row = cursor.fetchone()

        if row is None:
            raise ValueError("Chart code not found.")

        return ChartCodeRead(**row)