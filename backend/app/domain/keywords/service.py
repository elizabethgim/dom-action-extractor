from typing import List

from app.domain.keywords.schemas import ActionDescriptor, RankedEntry

_model = None


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def rank_actions(
    question: str,
    actions: List[ActionDescriptor],
    top_k: int = 30,
) -> List[RankedEntry]:
    if not actions:
        return []

    model = get_model()
    from sentence_transformers import util

    # action마다 text + datum_name 합쳐서 embedding
    action_texts = [
        f"{a.text} {a.datum_name}".strip() or a.action_type
        for a in actions
    ]

    question_emb = model.encode(question, normalize_embeddings=True)
    action_embs = model.encode(action_texts, normalize_embeddings=True)

    scores = util.cos_sim(question_emb, action_embs)[0]

    top_k_actual = min(top_k, len(actions))
    top_indices = scores.topk(top_k_actual).indices.tolist()

    return [
        RankedEntry(id=actions[i].id, score=float(scores[i]))
        for i in top_indices
    ]
