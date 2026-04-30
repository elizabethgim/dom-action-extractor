from app.core.database import db_connection
from app.domain.charts_codes.schemas import ChartCodeCreate, ChartCodeRead

def create_chart_code(payload: ChartCodeCreate) -> ChartCodeRead:
    with db_connection() as connection:
        cursor = connection.execute(
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
        )
    
    row = cursor.fetchone()
    return ChartCodeRead(**row)


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