import type { BBox } from "./types/BBox";

export function toContainerBBox(container: HTMLElement, el: HTMLElement): BBox | null {
  const cr = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();

  const w = r.width;
  const h = r.height;
  if (!isFinite(w) || !isFinite(h) ) return null;

  return {
    x: r.left - cr.left,
    y: r.top - cr.top,
    w,
    h,
  };
}