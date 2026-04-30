from fastapi import HTTPException

from app.domain.ai_runs.repository import create_ai_run, get_ai_run
from app.domain.ai_runs.schemas import AiRunCreate, AiRunRead


def save_ai_run(payload: AiRunCreate) -> AiRunRead:
    return create_ai_run(payload)


def load_ai_run(run_id: int) -> AiRunRead:
    run = get_ai_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="AI run not found")
    return run

