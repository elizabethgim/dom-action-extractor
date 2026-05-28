from fastapi import APIRouter

from app.domain.keywords.schemas import RankActionsRequest, RankedActionResponse
from app.domain.keywords.service import rank_actions

router = APIRouter()


@router.post("/rank-actions", response_model=RankedActionResponse)
def rank_actions_endpoint(req: RankActionsRequest):
    ranked = rank_actions(req.question, req.actions, req.top_k)
    return RankedActionResponse(ranked=ranked)
