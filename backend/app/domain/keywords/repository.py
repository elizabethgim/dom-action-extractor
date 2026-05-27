from typing import Dict, Any
from fastapi import APIRouter

from schemas import RankActionsRequest, RankedActionResponse

router = APIRouter()

_embed_model = None
_question_cache: Dict[str, Any] = {}

def get_embed_model():
    global _embed_model
    if _embed_model is None:
        from sentence_transformers import SentenceTransformer
        _embed_model = SentenceTransformer("all-MiniLM-L6-v2")
    return _embed_model

@router.post("/rank-actions", response_model=RankedActionResponse)
def rank_actions(req: RankActionsRequest):
    question = req.question.strip()
    if question not in _question_cache:
        _question_cache[question] = model.encode(question, mormalize_embeddings=True)
        
    return RankedActionResponse(
        ranked=
    )