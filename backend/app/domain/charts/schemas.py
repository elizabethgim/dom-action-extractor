from dataclasses import dataclass, field

from pydantic import BaseModel


@dataclass(frozen=True)
class ChartDefinition:
    id: str
    title: str
    source: str
    family: str
    renderer: str
    description: str = ""
    dataset_id: str | None = None
    questions: list[str] = field(default_factory=list)


class ChartCreate(BaseModel):
    slug: str
    title: str
    source: str
    family: str
    renderer: str
    description: str = ""
    dataset_id: str | None = None
    questions: list[str] = []

