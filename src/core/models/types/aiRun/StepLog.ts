import type { imageState } from "@core/models/interface/IimageState";
import type { StopReason } from "./StopReason";

export type StepLog = {
  step: number;
  
  // inputs
  question: string;
  chartType: string;

  // state capture
  beforeCapId: string;
  before: imageState;

  // action candidates (optional: 너무 크면 저장하지 말고 summary만 저장)
  actionCount: number;

  // model plan + extracted answer
  planRaw: unknown; // decideNextAction 결과 그대로 저장(디버깅)
  targetIndex: number | null;
  answerable: "YES" | "NO" | null;

  // chosen action snapshot
  chosenAction?: {
    actionId: string;
    actionType: string;
    selector: string;
    datumName?: string;
    text?: string;
  };

  // action before/after (action 직전/직후 — 효과 비교용)
  beforeActionCapId?: string;
  beforeAction?: imageState;
  afterCapId?: string;
  after?: imageState;

  // stop info
  stopReason?: StopReason;
  error?: string;
};