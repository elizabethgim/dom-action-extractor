from pydantic import BaseModel
from typing import List


class ActionDescriptor(BaseModel):
    id: str
    text: str = ""
    datum_name: str = ""
    action_type: str = ""


class RankedEntry(BaseModel):
    id: str
    score: float


class RankActionsRequest(BaseModel):
    question: str
    actions: List[ActionDescriptor]
    top_k: int = 30


class RankedActionResponse(BaseModel):
    ranked: List[RankedEntry]
