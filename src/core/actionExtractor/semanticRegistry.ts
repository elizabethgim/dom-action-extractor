import type { IActions } from "@/core/models/interface/IActions";

export type SemanticEntry = {
  signature: string;
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

function elementSignature(action: IActions): string {
  const tag = action.element.tagName.toLowerCase();
  const cls = (action.elementInfo.className ?? "")
    .split(/\s+/)
    .filter(c => !c.startsWith("action-id"))
    .slice(0, 3)
    .join(".");
  return `${tag}${cls ? "." + cls : ""}`;
}

export function addSemanticEntry(action: IActions, effect: string) {
  const signature = elementSignature(action);
  const existing = registry.find(
    e => e.signature === signature && e.actionType === action.actionType
  );
  if (existing) {
    existing.effect = effect;
  } else {
    registry.push({
      signature,
      actionType: action.actionType,
      datumName: action.datum?.name?.toString() ?? null,
      effect,
    });
  }
}

export function findMatchingEffects(
  actions: IActions[]
): { index: number; effect: string }[] {
  return actions.flatMap((action, index) => {
    const sig = elementSignature(action);
    const datumName = action.datum?.name?.toString() ?? null;
    const match = registry.find(
      e =>
        e.actionType === action.actionType &&
        (e.signature === sig || (datumName && e.datumName === datumName))
    );
    return match ? [{ index, effect: match.effect }] : [];
  });
}
