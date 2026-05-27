import type { StepLog } from "@/core/models/types/aiRun/StepLog";


export type SaveAiRunInput = {
  source: string;
  family: string;
  chartId: string;
  selectedQuestionIndex: number;
  questionText: string;
  stopReason: string | null;
  steps: StepLog[];
};

export type SavedAiRun = SaveAiRunInput & {
  id: string;
  createdAt: string;
};

type AiRunStepResponse = {
  stepIndex: number;
  payload: StepLog;
};

type AiRunResponse = Omit<SavedAiRun, "steps"> & {
  chart_id?: string;
  selected_question_index?: number;
  question_text?: string;
  stop_reason?: string | null;
  created_at?: string;
  steps: AiRunStepResponse[];
};

export async function saveAiRun(input: SaveAiRunInput): Promise<SavedAiRun> {
  const url = new URL(`/api/ai-logs`, window.location.origin);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(await response.text());

  return normalizeAiRun(await response.json());
}

export async function getAiRun(runId: string): Promise<SavedAiRun> {
  const url = new URL(`/api/ai-logs/${runId}`, window.location.origin);
  const response = await fetch(url.toString());

  if (!response.ok) throw new Error(await response.text());

  return normalizeAiRun(await response.json());
}

function normalizeAiRun(response: AiRunResponse): SavedAiRun {
  return {
    ...response,
    chartId: response.chartId ?? response.chart_id ?? "",
    selectedQuestionIndex:
      response.selectedQuestionIndex ?? response.selected_question_index ?? 0,
    questionText: response.questionText ?? response.question_text ?? "",
    stopReason: response.stopReason ?? response.stop_reason ?? null,
    createdAt: response.createdAt ?? response.created_at ?? "",
    steps: response.steps.map((step) => step.payload),
  };
}
