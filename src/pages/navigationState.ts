import type { ChartId } from "@core/charts/chartRegistry";
import type { StepLog } from "@core/models/types/aiRun";

export type SystemToAiState = {
  source: string;
  family: string;
  selectedChartId: ChartId;
  selectedQuestionIndex: number;
  questionText: string;
};

export type AiToAnimationState = SystemToAiState & {
  runId?: number;
  steps: StepLog[];
  selectedStepIndex: number;
  stopReason: string | null;
};
