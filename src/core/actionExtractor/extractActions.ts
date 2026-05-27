import { bindActionId } from "./actionId";
import { DEFAULT_EVENTS, toActionType, bestEvent } from "./DefaultEventType";
import type { ActionType } from "./DefaultEventType";
import { getHookRegistry } from "./hook";
import type { IActions } from "@/core/models/interface/IActions";
import type { D3Element } from "@/core/models/interface/Id3Element";
import type { IDatum } from "@/core/models/interface/IDatum";
import { indexAction } from "./actionIdStore";

const ACTION_ATTR = "data-action-id"; // actionType별: data-action-id-hover 등

let actionRegistry: IActions[] = [];

export function resetExtractRegistries() {
  actionRegistry = [];
  // 차트 재렌더 시 호출 — 기존에 부여된 DOM attribute도 정리
  document.querySelectorAll(`[${ACTION_ATTR}]`).forEach(el => {
    Array.from(el.attributes)
      .filter(a => a.name.startsWith(ACTION_ATTR))
      .forEach(a => el.removeAttribute(a.name));
  });
}

export async function extractActions(step: number) {
  actionRegistry = [];

  const registry = getHookRegistry();
  let num = 0;

  for (const [el, events] of registry.entries()) {
    if (!(el instanceof Element)) continue;
    if (!el.closest("svg")) continue;

    const byActionType = new Map<ActionType, string[]>();
    for (const evtType of DEFAULT_EVENTS) {
      const handlers = events?.[evtType];
      if (!handlers || handlers.size === 0) continue;
      const actionType = toActionType(evtType);
      if (!actionType) continue;
      if (!byActionType.has(actionType)) byActionType.set(actionType, []);
      byActionType.get(actionType)!.push(evtType);
    }

    for (const [actionType, candidates] of byActionType) {
      const attrName = `${ACTION_ATTR}-${actionType}`;
      const existing = el.getAttribute(attrName);
      const actionId = existing ?? bindActionId(actionType, step, num);

      if (!existing) {
        el.setAttribute(attrName, actionId);
        indexAction(el, actionType, actionId);
      }

      actionRegistry.push({
        step,
        num,
        actionId,
        actionType,
        eventType: bestEvent(candidates),
        element: el,
        elementInfo: {
          id: el.id,
          className: el.getAttribute("class") ?? "",
          innerHTML: el.innerHTML,
        },
        selector: shortSelector(el),
        text: (el.textContent || "").trim(),
        boundingBox: bboxSummary(el),
        code: events.listener,
        datum: getDatumLabel(el),
      });
    }

    num++;
  }
}

function bboxSummary(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: parseFloat(r.x.toFixed(2)), y: parseFloat(r.y.toFixed(2)), w: parseFloat(r.width.toFixed(2)), h: parseFloat(r.height.toFixed(2)) };
}

function shortSelector(el: Element) {
  const id = el.id ? `${el.id}` : "";
  const cls = (el.getAttribute("class") || "")
    .split(/\s+/).filter(Boolean).slice(0, 2).join(".");
  if (id === "" && cls === "") return null;
  return `${id ? "#" + id : ""}${cls ? "." + cls : ""}`;
}

export function getActionRegistry() {
  return actionRegistry;
}

export function setActionRegistry(ranked: IActions[]) {
  actionRegistry = ranked;
}

function getDatumLabel(el: D3Element): IDatum | null {
  const d = el.__data__;
  if (!d) return null;
  const name = d?.data?.name ?? d?.name ?? d?.id ?? null;
  return { name };
}
