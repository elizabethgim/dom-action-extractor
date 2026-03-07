// d3On.ts
export type D3OnEntry = {
  type: string;          // e.g. "click", "mousemove"
  name?: string;         // 네임스페이스 (있을 수도)
  capture?: boolean;
  fnName: string;
  source: string;        // fn.toString()
};

export function getD3OnEntries(el: Element): D3OnEntry[] {
  const arr = (el as any).__on as any[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return [];

  return arr.map((d) => {
    const value = d?.value; // d3가 저장하는 "원본 핸들러"
    const fn = typeof value === "function" ? value : null;

    return {
      type: String(d?.type ?? ""),
      name: d?.name ? String(d.name) : undefined,
      capture: Boolean(d?.capture),
      fnName: fn?.name || "(anonymous)",
      source: fn ? safeFnToString(fn) : "(no function)",
    };
  });
}

function safeFnToString(fn: Function) {
  try {
    return Function.prototype.toString.call(fn);
  } catch {
    return "(toString failed)";
  }
}