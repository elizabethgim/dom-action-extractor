from fastapi import APIRouter

from app.domain.ai_runs.schemas import AiRunCreate
from app.domain.ai_runs.service import list_ai_run_summaries, load_ai_run, save_ai_run


router = APIRouter(prefix="/ai-logs", tags=["ai-logs"])


@router.post("")
def create_ai_run_entry(payload: AiRunCreate):
    return save_ai_run(payload)


@router.get("")
def list_ai_run_entries():
    return list_ai_run_summaries()


@router.get("/{run_id}")
def get_ai_run_entry(run_id: str):
    return load_ai_run(run_id)

