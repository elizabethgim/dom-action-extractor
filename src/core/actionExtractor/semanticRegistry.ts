import type { IActions } from "@/core/models/interface/IActions";

export type SemanticEntry = {
  actionId: string;
  actionType: IActions["actionType"];
  datumName: string | null;
  effect: string;
};

let registry: SemanticEntry[] = [];

export function resetSemanticRegistry() {
  registry = [];
}

export function getSemanticRegistry(): SemanticEntry[] {
  return registry;
}

// actionId is a stable per-DOM-element attribute (see extractActions.ts), so it
// uniquely identifies one node — unlike tag+class, which every sibling in a
// hierarchy/bar chart shares, causing one node's effect to bleed onto all others.
export function addSemanticEntry(action: IActions, effect: string) {
  const datumName = action.datum?.name?.toString() ?? null;
  const existing = registry.find(
    e => e.actionId === action.actionId && e.actionType === action.actionType
  );
  if (existing) {
    existing.effect = effect;
    existing.datumName = datumName;
  } else {
    registry.push({
      actionId: action.actionId,
      actionType: action.actionType,
      datumName,
      effect,
    });
  }
}

export function findMatchingEffects(
  actions: IActions[]
): { index: number; effect: string }[] {
  return actions.flatMap((action, index) => {
    const datumName = action.datum?.name?.toString() ?? null;
    const match =
      registry.find(
        e => e.actionId === action.actionId && e.actionType === action.actionType
      ) ??
      (datumName
        ? registry.find(
            e => e.actionType === action.actionType && e.datumName === datumName
          )
        : undefined);
    return match ? [{ index, effect: match.effect }] : [];
  });
}
