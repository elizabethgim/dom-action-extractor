import type { ActionType } from "../types/actionType";

export interface ProbeOptions {
  type?: ActionType;
  clientX: number;
  clientY: number;
  wheelDeltaY?: number;
  waitMs?: number;
}