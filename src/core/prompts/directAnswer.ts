import type { IActions } from "@/core/models/interface/IActions";

export type DirectAnswerResponse = {
  answer: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  relevant_actions?: { index: number; actionType: string; datum?: string | null; reason: string }[];
};

export function generateDirectAnswerPrompt(
  chartType: string,
  question: string,
  availableActions: IActions[],
): string {
  const pa = JSON.stringify(summarizeActionsWithCode(availableActions), null, 2);

  return `You are analyzing an interactive ${chartType} chart.

Question: ${question}

You are given a screenshot of the chart and a list of available interactions with their callback function source code. Answer the question directly based on what you can observe in the chart image and by reading the interaction code to understand what each action does.

Do NOT simulate interactions. Reason from the visible chart state and the callback logic.

Available interactions (indexed):
${pa}

Respond with JSON only:
{
  "answer": string,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": string,
  "relevant_actions": [
    { "index": number, "actionType": string, "datum": string | null, "reason": string }
  ]
}`;
}

function summarizeActionsWithCode(actions: IActions[]) {
  return actions.map((a, i) => ({
    index: i,
    actionType: a.actionType,
    eventType: a.eventType,
    datum: a.datum?.name ?? null,
    text: a.text || undefined,
    selector: a.selector || undefined,
    boundingBox: a.boundingBox,
    callbacks: (a.d3On ?? []).map((entry) => ({
      type: entry.type,
      name: entry.name,
      fnName: entry.fnName,
      source: entry.source,
    })),
  }));
}
