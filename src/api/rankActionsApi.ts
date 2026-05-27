import type { IActions } from "@/core/models/interface/IActions";

type ActionDescriptor = {
  id: string;
  text: string;
  datum_name: string;
  action_type: string;
};

type RankedEntry = {
  id: string;
  score: number;
};

type RankActionsResponse = {
  ranked: RankedEntry[];
};

/**
 * Sends current actions + question to the KeyWordBERT server (/rank-actions)
 * which uses sentence-transformers to compute semantic similarity.
 * Returns a re-ordered, top-k filtered IActions[].
 * Falls back to the original order if the server is unavailable.
 */
export async function rankActionsApi(
  question: string,
  actions: IActions[],
  topK = 30,
  signal?: AbortSignal,
): Promise<IActions[]> {
  if (actions.length === 0) return actions;

  const payload: ActionDescriptor[] = actions.map((a) => ({
    id: a.actionId,
    text: a.text ?? "",
    datum_name: (a.datum?.name ?? "").toString(),
    action_type: a.actionType,
  }));

  try {
    const res = await fetch("/rank-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, actions: payload, top_k: topK }),
      signal,
    });

    if (!res.ok) throw new Error(`rank-actions ${res.status}`);

    const data: RankActionsResponse = await res.json();

    // Reorder actions according to server ranking (top-k only)
    const idToAction = new Map(actions.map((a) => [a.actionId, a]));
    const ranked = data.ranked
      .map((r) => idToAction.get(r.id))
      .filter((a): a is IActions => a != null);

    return ranked;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.warn("[rankActionsApi] fallback to original order:", e);
    return actions;
  }
}
