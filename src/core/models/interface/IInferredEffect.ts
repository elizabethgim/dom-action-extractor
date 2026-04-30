import type { EffectType } from "../types/effectTypes";

export interface InferredEffect {
  type: EffectType;
  evidence: string[];
  description: string;
}

