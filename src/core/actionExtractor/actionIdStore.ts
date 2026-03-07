type EvtType = string;

// 1) LLM plan(actionId) -> element 찾기용
const elByActionId = new Map<string, Element>();

// 2) Logger(event -> actionId) 찾기용 (element별로 evtType -> id)
const actionIdByEl = new WeakMap<Element, Map<EvtType, string>>();

export function makeActionId(evt: string, step: number, elementIdx: number) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${evt}-step${pad2(step)}-element${pad2(elementIdx)}`;
}

export function indexAction(el: Element, evtType: string, actionId: string) {
  // id -> el
  elByActionId.set(actionId, el);

  // el -> (evt -> id)
  let m = actionIdByEl.get(el);
  if (!m) {
    m = new Map();
    actionIdByEl.set(el, m);
  }
  m.set(evtType, actionId);

  // DOM에도 심어두면 currentTarget/closest로 복구 가능
  el.setAttribute(`action-id-${evtType}`, actionId);
}

export function getElementByActionId(actionId: string) {
  return elByActionId.get(actionId) ?? null;
}

// Logger에서 사용: 이벤트로부터 actionId resolve
export function resolveActionIdFromEvent(e: Event): string | null {
  const evtType = e.type;
  const t = e.target as Element | null;
  const ct = (e as any).currentTarget as Element | null;

  // 1) target에서 위로 올라가며 data-action-id-<evt> 찾기
  const sel = `[data-action-id-${CSS.escape(evtType)}]`;
  const hit = t?.closest?.(sel) ?? ct?.closest?.(sel) ?? null;
  if (hit) return hit.getAttribute(`action-id-${evtType}`);

  // 2) WeakMap 조회 (target/currentTarget 둘 다 시도)
  const m1 = t ? actionIdByEl.get(t) : undefined;
  if (m1?.has(evtType)) return m1.get(evtType)!;

  const m2 = ct ? actionIdByEl.get(ct) : undefined;
  if (m2?.has(evtType)) return m2.get(evtType)!;

  return null;
}

// step마다 다시 추출한다면 매번 초기화 권장
export function clearActionIdIndex() {
  elByActionId.clear();
  // WeakMap은 clear가 없음 (엘리먼트 GC되면 자연 소멸)
}