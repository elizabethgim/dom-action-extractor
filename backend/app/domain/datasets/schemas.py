from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DatasetField:
    name: str
    type: str


@dataclass(frozen=True)
class DatasetDefinition:
    id: str
    title: str
    description: str
    fields: list[DatasetField]
    load: Callable[..., dict[str, Any]]
