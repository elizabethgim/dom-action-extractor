# app/routes/chart_codes.py
from fastapi import APIRouter, HTTPException

from app.domain.chart_codes.schemas import ChartCodeCreate, ChartCodeRead
from app.domain.chart_codes.repository import create_chart_code, get_chart_code, list_chart_codes

router = APIRouter(prefix="/chart-codes", tags=["chart-codes"])


@router.get("", response_model=list[ChartCodeRead])
def list_chart_code_entries():
    return list_chart_codes()


@router.post("", response_model=ChartCodeRead)
def create_chart_code_entry(payload: ChartCodeCreate):
    return create_chart_code(payload)


@router.get("/{chart_id}", response_model=ChartCodeRead)
def read_chart_code(chart_id: int):
    try:
        return get_chart_code(chart_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Chart code not found.")