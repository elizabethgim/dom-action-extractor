// d3Run.ts
export function runD3On(el: Element, type?: string, options?: { clientX: number; clientY: number}) {
  const arr = (el as any).__on as any[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return;

  const data = (el as any).__data__; // d3 datum
  const targets = type ? arr.filter((x) => x?.type === type) : arr;

  for (const h of targets) {
    console.log(h);
    const fn = h?.value;
    if (typeof fn !== "function") continue;

    const ev = makeEvent(h.type, options);

    fn.call(el, ev, data);
  }
}

function makeEvent(type: string, options?: { clientX?: number; clientY?: number}) {
  const clientX = options?.clientX ?? 0;
  const clientY = options?.clientY ?? 0;

  if (type.startsWith("mouse") || type === "click" || type === "dblclick") {
    return new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY});
  }

  return new Event(type, { bubbles: true, cancelable: true });
}