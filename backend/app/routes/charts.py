from fastapi import APIRouter

from app.domain.charts.schemas import ChartCreate
from app.domain.charts.service import create_chart, get_chart, list_charts

router = APIRouter(prefix="/charts", tags=["charts"])


@router.get("")
def list_chart_entries():
    return list_charts()


@router.post("")
def create_chart_entry(data: ChartCreate):
    return create_chart(data)


@router.get("/{chart_id}")
def get_chart_entry(chart_id: str):
    return get_chart(chart_id)
