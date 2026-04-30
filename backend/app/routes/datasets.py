from fastapi import APIRouter

from app.domain.datasets.service import get_dataset_data, list_datasets


router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.get("")
def list_dataset_entries():
    return list_datasets()


@router.get("/{dataset_id}/data")
def get_dataset_rows(dataset_id: str, year: int | None = None):
    return get_dataset_data(dataset_id, year=year)

