export type QuestionType = "exact_value_lookup" | "comparison" | "hierarchical_reveal";
export type StructuralComplexity = "flat" | "hierarchical";
export type InteractionComplexity = "low" | "high";
export type ReasoningComplexity = "single_step" | "multi_step";

export type CreateBenchmarkEpisodeInput = {
  runId: string;
  answer: string;
  questionType: QuestionType;
  structuralComplexity: StructuralComplexity;
  interactionComplexity: InteractionComplexity;
  reasoningComplexity: ReasoningComplexity;
  notes: string;
};

export type BenchmarkEpisode = CreateBenchmarkEpisodeInput & {
  id: string;
  createdAt: string;
  chartId: string;
  source: string;
  family: string;
  questionText: string;
  stepCount: number;
};

type BenchmarkEpisodeResponse = BenchmarkEpisode & {
  run_id?: string;
  question_type?: QuestionType;
  structural_complexity?: StructuralComplexity;
  interaction_complexity?: InteractionComplexity;
  reasoning_complexity?: ReasoningComplexity;
  created_at?: string;
  chart_id?: string;
  question_text?: string;
  step_count?: number;
};

function normalizeBenchmarkEpisode(response: BenchmarkEpisodeResponse): BenchmarkEpisode {
  return {
    id: response.id,
    runId: response.runId ?? response.run_id ?? "",
    answer: response.answer,
    questionType: response.questionType ?? response.question_type ?? "exact_value_lookup",
    structuralComplexity: response.structuralComplexity ?? response.structural_complexity ?? "flat",
    interactionComplexity: response.interactionComplexity ?? response.interaction_complexity ?? "low",
    reasoningComplexity: response.reasoningComplexity ?? response.reasoning_complexity ?? "single_step",
    notes: response.notes ?? "",
    createdAt: response.createdAt ?? response.created_at ?? "",
    chartId: response.chartId ?? response.chart_id ?? "",
    source: response.source,
    family: response.family,
    questionText: response.questionText ?? response.question_text ?? "",
    stepCount: response.stepCount ?? response.step_count ?? 0,
  };
}

export async function createBenchmarkEpisode(
  input: CreateBenchmarkEpisodeInput
): Promise<BenchmarkEpisode> {
  const url = new URL(`/api/benchmark-episodes`, window.location.origin);
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) throw new Error(await response.text());

  return normalizeBenchmarkEpisode(await response.json());
}

export async function listBenchmarkEpisodes(): Promise<BenchmarkEpisode[]> {
  const url = new URL(`/api/benchmark-episodes`, window.location.origin);
  const response = await fetch(url.toString());

  if (!response.ok) throw new Error(await response.text());

  const data: BenchmarkEpisodeResponse[] = await response.json();
  return data.map(normalizeBenchmarkEpisode);
}
