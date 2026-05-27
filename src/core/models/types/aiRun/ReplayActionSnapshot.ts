import type { IActions } from "@core/models/interface/IActions";

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