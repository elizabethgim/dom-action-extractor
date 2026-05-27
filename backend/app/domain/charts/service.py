from fastapi import HTTPException

from app.domain.charts.repository import create_chart_definition, get_chart_definition, list_chart_definitions
from app.domain.charts.schemas import ChartCreate, ChartDefinition


def _serialize_chart(chart: ChartDefinition) -> dict[str, object]:
    return {
        "id": chart.id,
        "slug": chart.slug,
        "title": chart.title,
        "source": chart.source,
        "family": chart.family,
        "renderer": chart.renderer,
        "description": chart.description,
        "dataset_id": chart.dataset_id,
        "questions": chart.questions,
    }


def list_charts() -> list[dict[str, object]]:
    return [_serialize_chart(chart) for chart in list_chart_definitions()]


def get_chart(chart_id: str) -> dict[str, object]:
    chart = get_chart_definition(chart_id)
    if chart is None:
        raise HTTPException(status_code=404, detail="Chart not found")

    return _serialize_chart(chart)


def create_chart(data: ChartCreate) -> dict[str, object]:
    chart = create_chart_definition(data)
    return _serialize_chart(chart)
