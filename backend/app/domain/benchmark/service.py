from fastapi import HTTPException
from psycopg.errors import UniqueViolation

from app.domain.benchmark.repository import (
    create_benchmark_episode,
    list_benchmark_episodes,
)
from app.domain.benchmark.schemas import BenchmarkEpisodeCreate, BenchmarkEpisodeRead


def save_benchmark_episode(payload: BenchmarkEpisodeCreate) -> BenchmarkEpisodeRead:
    try:
        return create_benchmark_episode(payload)
    except UniqueViolation as exc:
        raise HTTPException(
            status_code=409, detail="This run has already been labeled as a benchmark episode."
        ) from exc


def list_benchmark_episode_entries() -> list[BenchmarkEpisodeRead]:
    return list_benchmark_episodes()
