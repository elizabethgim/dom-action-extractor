import type { IActions } from "@/core/models/interface/IActions";
import type { StepLog } from "@/core/models/types/aiRun/StepLog";

export function getElementBoxInContainer(element: Element, container: HTMLElement) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const minSize = 18;
  const width = Math.max(elementRect.width, minSize);
  const height = Math.max(elementRect.height, minSize);
  const left = elementRect.left - containerRect.left + container.scrollLeft - (width - elementRect.width) / 2;
  const top = elementRect.top - containerRect.top + container.scrollTop - (height - elementRect.height) / 2;

  return { left, top, width, height };
}

export function getCueLabel(action: IActions) {
  const target =
    action.datum?.name != null
      ? String(action.datum.name)
      : action.text?.trim() || action.elementInfo?.id || action.element.tagName.toLowerCase();

  return `${action.actionType}${target ? `: ${target}` : ""}`;
}

// Finds the live IActions entry (from a freshly extracted registry) matching
// a recorded chosenAction, so an old step log can be replayed against a
// chart that's currently mounted in the page.
export function findLiveAction(
  chosen: NonNullable<StepLog["chosenAction"]>,
  registry: IActions[],
  container: HTMLElement,
): IActions | null {
  if (chosen.datumName) {
    const match = registry.find(
      (a) => a.actionType === chosen.actionType && a.datum?.name != null && String(a.datum.name) === chosen.datumName
    );
    if (match) return match;
  }

  const text = chosen.text;
  if (text) {
    const match = registry.find(
      (a) => a.actionType === chosen.actionType && (a.text?.trim() || "") === text.trim()
    );
    if (match) return match;
  }

  if (chosen.selector) {
    const el = container.querySelector(chosen.selector);
    if (el) {
      const found = registry.find((a) => a.element === el && a.actionType === chosen.actionType);
      if (found) return found;
      return {
        actionId: chosen.actionId,
        actionType: chosen.actionType as "click" | "hover" | "zoom",
        eventType: chosen.actionType === "hover" ? "mouseenter" : chosen.actionType,
        element: el,
        elementInfo: { id: el.id, className: el.getAttribute("class") ?? "", innerHTML: "" },
        datum: null,
      } as IActions;
    }
  }

  return null;
}
