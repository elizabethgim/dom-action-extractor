import type { StepLog } from "@core/models/types/aiRun/StepLog";

export type SystemToAiState = {
  source: string;
  family: string;
  selectedChartId: string;
  selectedQuestionIndex: number;
  questionText: string;
};

export type AiToAnimationState = SystemToAiState & {
  runId?: string;
  steps: StepLog[];
  selectedStepIndex: number;
  stopReason: string | null;
};
