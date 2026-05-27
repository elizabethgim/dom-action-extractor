import type { IActions } from "@/core/models/interface/IActions";

export function generatePrompt(
  chartType: string,
  question: string,
  actionHistory: Partial<IActions>[],
  possiblaActions: IActions[],
  semanticContext?: { index: number; effect: string }[]
){
    const ah = JSON.stringify(summarizeActions(actionHistory), null, 2);
    const pa = JSON.stringify(summarizeActionsWithEffects(possiblaActions, semanticContext ?? []), null, 2);

    return `You are interacting with an interactive ${chartType} chart.
Goal: Answer the question.
Question: ${question}

Task:
 1. Determine whether the question can be answered with the current visible chart state.
 2. If you can't answer the question right away, identify a single interaction that should be performed next and explain why.
 3. The answer should be presentable in the chart.

Rules:
- Do NOT give general advice. Output JSON only.
- You MUST choose exactly one action from the provided action list.
- If none of the possible actions list help, return {"answerable": "YES", "type":"NO_ACTION","reason":"..."}.

Output JSON example:
{
  "answerable": "YES" | "NO",
  "type": "CLICK" | "HOVER" | "ZOOM" | "NO_ACTION", // the type of action you need to do
  "targetIndex": number,
  "reason": string,
}

Action history:
${ah}

Current available actions (indexed):
${pa}`;

}


function summarizeActions(actions: Partial<IActions>[]) {
  return actions.map((a, i) => ({
    index: i,
    actionType: a.actionType,
    datum: a.datum,
    boundingBox: a.boundingBox,
    callbackFunction: a.code,
  }));
}

function summarizeActionsWithEffects(
  actions: IActions[],
  semanticContext: { index: number; effect: string }[]
) {
  const effectMap = new Map(semanticContext.map(s => [s.index, s.effect]));
  return actions.map((a, i) => {
    const base = {
      index: i,
      actionType: a.actionType,
      datum: a.datum,
      boundingBox: a.boundingBox,
      callbackFunction: a.code,
    };
    const known = effectMap.get(i);
    return known ? { ...base, knownEffect: known } : base;
  });
}