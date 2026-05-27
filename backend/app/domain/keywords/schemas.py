from pydantic import BaseModel
from typing import List


class ActionDescriptor(BaseModel):
    id: str
    text: str = ""
    datum: str = ""
    action_type: str=""

class RanekdEntry(BaseModel):
    id: str
    scroe: float

class RankActionsRequest(BaseModel):
    question: str
    actions: List[ActionDescriptor]
    top_k: int = 10

class RankedActionResponse(BaseModel):
    ranked: List[RanekdEntry]
