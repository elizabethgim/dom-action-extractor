import { bindActionId } from "./actionId";
import { DEFAULT_EVENTS, toActionType, bestEvent } from "./DefaultEventType";
import type { ActionType } from "./DefaultEventType";
import { getHookRegistry } from "./hook";
import type { IActions } from "@/core/models/interface/IActions";
import type { D3Element } from "@/core/models/interface/Id3Element";
import type { IDatum } from "@/core/models/interface/IDatum";
import { indexAction } from "./actionIdStore";


let actionRegistry: IActions[] = [];
let elementRegistry: IElement[] = [];

export interface IElement {
  index: number;
  element: Element;
}

export function resetExtractRegistries() {
  actionRegistry = [];
  elementRegistry = [];
}

export async function extractActions(step: number) {
  // 이전 step의 DOM attribute 제거
  for (const { element } of elementRegistry) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith("action-id-")) element.removeAttribute(attr.name);
    }
  }
  actionRegistry = [];
  elementRegistry = [];

  const registry = getHookRegistry();
  let num = 0;

  for (const [el, events] of registry.entries()) {
    if (!(el instanceof Element)) continue;
    if (!el.closest("svg")) continue;

    elementRegistry.push({ index: num, element: el });

    // 감지된 이벤트를 actionType별로 그룹화
    const byActionType = new Map<ActionType, string[]>();
    for (const evtType of DEFAULT_EVENTS) {
      const handlers = events?.[evtType];
      if (!handlers || handlers.size === 0) continue;
      const actionType = toActionType(evtType);
      if (!actionType) continue;
      if (!byActionType.has(actionType)) byActionType.set(actionType, []);
      byActionType.get(actionType)!.push(evtType);
    }

    // actionType당 하나씩만 등록 (우선순위 높은 rawEvent 선택)
    for (const [actionType, candidates] of byActionType) {
      const attrName = `action-id-${actionType}`;
      const existing = el.getAttribute(attrName);
      const actionId = existing ?? bindActionId(actionType, step, num);

      if (!existing) {
        el.setAttribute(attrName, actionId);

        actionRegistry.push({
          step,
          num,
          actionId,
          actionType,
          eventType: bestEvent(candidates),
          element: el,
          elementInfo: {
            id: el.id,
            className: el.className,
            innerHTML: el.innerHTML,
          },
          selector: shortSelector(el),
          text: (el.textContent || "").trim(),
          boundingBox: bboxSummary(el),
          code: events.listener,
          datum: getDatumLabel(el),
        });

        indexAction(el, actionType, actionId);
      }
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

export function getElementRegistry() {
  return elementRegistry;
}

function getDatumLabel(el: D3Element): IDatum | null {
  const d = el.__data__;
  if (!d) return null;
  const name = d?.data?.name ?? d?.name ?? d?.id ?? null;
  return { name };
}
