from fastapi import APIRouter

from app.domain.benchmark.schemas import BenchmarkEpisodeCreate
from app.domain.benchmark.service import (
    list_benchmark_episode_entries,
    save_benchmark_episode,
)

router = APIRouter(prefix="/benchmark-episodes", tags=["benchmark-episodes"])


@router.post("")
def create_benchmark_episode_entry(payload: BenchmarkEpisodeCreate):
    return save_benchmark_episode(payload)


@router.get("")
def list_benchmark_episode_entries_route():
    return list_benchmark_episode_entries()
