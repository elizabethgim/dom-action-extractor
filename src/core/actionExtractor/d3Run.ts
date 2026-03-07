// d3Run.ts
export function runD3On(el: Element, type?: string) {
  const arr = (el as any).__on as any[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return;

  const data = (el as any).__data__; // d3 datum
  const targets = type ? arr.filter((x) => x?.type === type) : arr;

  for (const h of targets) {
    const fn = h?.value;
    if (typeof fn !== "function") continue;

    // 이벤트 타입에 맞춰 대충 이벤트 객체 만들어주기
    const ev = makeEvent(h.type);

    // ✅ d3 핸들러 실행 (this = element, args = (event, datum))
    fn.call(el, ev, data);
  }
}

function makeEvent(type: string) {
  // click / mousemove 같은 건 MouseEvent가 더 자연스러움
  if (type.startsWith("mouse") || type === "click" || type === "dblclick") {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0, clientY: 0 });
  }
  return new Event(type, { bubbles: true, cancelable: true });
}