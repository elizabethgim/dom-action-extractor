import type { StepLog } from "@/core/models/types/aiRun/StepLog";


export type SaveAiRunInput = {
  source: string;
  family: string;
  chartId: string;
  selectedQuestionIndex: number;
  questionText: string;
  stopReason: string | null;
  expectedAnswer?: string | null;
  grade?: string | null;
  pipelineVariant?: string;
  steps: StepLog[];
};

export type SavedAiRun = SaveAiRunInput & {
  id: string;
  createdAt: string;
};

export type AiRunSummary = {
  id: string;
  source: string;
  family: string;
  chartId: string;
  selectedQuestionIndex: number;
  questionText: string;
  stopReason: string | null;
  expectedAnswer?: string | null;
  grade?: string | null;
  pipelineVariant?: string;
  createdAt: string;
  stepCount: number;
};

type AiRunSummaryResponse = AiRunSummary & {
  chart_id?: string;
  selected_question_index?: number;
  question_text?: string;
  stop_reason?: string | null;
  expected_answer?: string | null;
  pipeline_variant?: string;
  created_at?: string;
  step_count?: number;
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
  expected_answer?: string | null;
  pipeline_variant?: string;
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

export async function listAiRuns(): Promise<AiRunSummary[]> {
  const url = new URL(`/api/ai-logs`, window.location.origin);
  const response = await fetch(url.toString());

  if (!response.ok) throw new Error(await response.text());

  const data: AiRunSummaryResponse[] = await response.json();
  return data.map((run) => ({
    id: run.id,
    source: run.source,
    family: run.family,
    chartId: run.chartId ?? run.chart_id ?? "",
    selectedQuestionIndex: run.selectedQuestionIndex ?? run.selected_question_index ?? 0,
    questionText: run.questionText ?? run.question_text ?? "",
    stopReason: run.stopReason ?? run.stop_reason ?? null,
    expectedAnswer: run.expectedAnswer ?? run.expected_answer ?? null,
    grade: run.grade ?? null,
    pipelineVariant: run.pipelineVariant ?? run.pipeline_variant ?? "baseline",
    createdAt: run.createdAt ?? run.created_at ?? "",
    stepCount: run.stepCount ?? run.step_count ?? 0,
  }));
}

function normalizeAiRun(response: AiRunResponse): SavedAiRun {
  return {
    ...response,
    chartId: response.chartId ?? response.chart_id ?? "",
    selectedQuestionIndex:
      response.selectedQuestionIndex ?? response.selected_question_index ?? 0,
    questionText: response.questionText ?? response.question_text ?? "",
    stopReason: response.stopReason ?? response.stop_reason ?? null,
    expectedAnswer: response.expectedAnswer ?? response.expected_answer ?? null,
    grade: response.grade ?? null,
    pipelineVariant: response.pipelineVariant ?? response.pipeline_variant ?? "baseline",
    createdAt: response.createdAt ?? response.created_at ?? "",
    steps: response.steps.map((step) => step.payload),
  };
}
