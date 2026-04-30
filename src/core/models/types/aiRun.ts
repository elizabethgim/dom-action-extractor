import type { imageState } from "@core/utils/getCapture";
import type { IActions } from "@core/models/interface/IActions";

export type StopReason =
  | "ANSWERED"
  | "NO_PLAN"
  | "NO_ACTION"
  | "MAX_STEP"
  | "ERROR"
  | "USER_STOP";

export type ReplayActionSnapshot = {
  // replay 핵심 키
  actionId: string;                 // IActions.id (stable)
  selector: string;                 // `[data-action-id="..."]` (fallback)

  // for UI/diagnostics
  type: IActions["actionType"];
  // eventType?: IActions["eventType"];
  description?: string;
  elementIndex?: number; 

  // event params (필요한 경우)
  params?: {
    deltaY?: number;                // wheel
    clientX?: number;               // click/hover
    clientY?: number;
    button?: number;
    key?: string;
  };
};

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
  // chosenAction?: Pick<IActions, "id" | "type" | "elementIndex" | "description" | "eventType">;

  // after
  afterCapId?: string;
  after?: imageState;

  // stop info
  stopReason?: StopReason;
  error?: string;
};