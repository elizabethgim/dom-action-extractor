import type { IActions } from "@/core/models/interface/IActions";
import type { KeywordResult } from "@/api/keywordsApi";

export type ScoredAction = { 
  action: IActions; 
  score: number; 
  matchedKeywords: string[] 
};

const TYPE_TO_ACTION: Partial<Record<string, IActions["actionType"]>> = {
  AGG_MAX: "hover",
  AGG_MIN: "hover",
  AGG_AVG: "hover",
  TIME: "zoom",
  TERM: "hover",
};

export function scoreActions(actions: IActions[], kw: KeywordResult): ScoredAction[] {
  const kwList = kw.keywords;
  const preferredActionType = kwList
    .map(k => TYPE_TO_ACTION[k.type])
    .find(t => t != null);

  return actions.map(action => {
    let score = 0;
    const matchedKeywords: string[] = [];
    const datumName = (action.datum?.name ?? "").toString().toLowerCase();
    const elemText = (action.text ?? "").toLowerCase();

    for (const k of kwList) {
      const kText = k.text.toLowerCase();
      if (datumName && datumName.includes(kText)) { score += k.score * 2; matchedKeywords.push(kText); }
      else if (elemText && elemText.includes(kText)) { score += k.score; matchedKeywords.push(kText); }
    }

    if (preferredActionType && action.actionType === preferredActionType) score += 0.3;

    return { action, score, matchedKeywords };
  });
}

const ACTION_TYPE_PRIORITY: Record<IActions["actionType"], number> = {
  hover: 0,
  click: 1,
  zoom: 2,
};

export function rankActions(actions: IActions[], kw: KeywordResult): IActions[] {
  const scored = scoreActions(actions, kw);
  const allZero = scored.every(s => s.score === 0);

  if (allZero) {
    return [...actions].sort(
      (a, b) => ACTION_TYPE_PRIORITY[a.actionType] - ACTION_TYPE_PRIORITY[b.actionType]
    );
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map(s => s.action);
}
