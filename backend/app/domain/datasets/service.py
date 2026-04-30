from fastapi import HTTPException

from app.domain.datasets.registry import DATASETS


def list_datasets() -> list[dict[str, object]]:
    return [
        {
            "id": dataset.id,
            "title": dataset.title,
            "description": dataset.description,
            "fields": [
                {"name": field.name, "type": field.type}
                for field in dataset.fields
            ],
        }
        for dataset in DATASETS.values()
    ]


def get_dataset_data(dataset_id: str, **filters: object) -> dict[str, object]:
    dataset = DATASETS.get(dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return dataset.load(**filters)
