export const DEFAULT_EVENTS = [
  "click", "dblclick",
  "mouseover", "mouseenter",
  "wheel",
];

export type ActionType = "click" | "hover" | "zoom";

export function toActionType(evtType: string): ActionType | null {
  if (evtType === "click" || evtType === "dblclick") return "click";
  if (evtType === "mouseover" || evtType === "mouseenter") return "hover";
  if (evtType === "wheel") return "zoom";
  return null;
}

// 같은 actionType 내에서 우선순위 — 높을수록 우선
const EVENT_PRIORITY: Record<string, number> = {
  click: 1,
  dblclick: 2,       // dblclick > click
  mouseenter: 1,
  mouseover: 2,      // mouseover > mouseenter
  wheel: 1,
};

export function bestEvent(candidates: string[]): string {
  return candidates.reduce((best, cur) =>
    (EVENT_PRIORITY[cur] ?? 0) > (EVENT_PRIORITY[best] ?? 0) ? cur : best
  );
}
