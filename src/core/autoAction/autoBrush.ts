
export function autoBrush(el: Element, from: {x: number, y:number }, to: {x: number, y:number }, steps = 5) {
  if (!el) return;

  el.dispatchEvent(new PointerEvent("pointerdown", {
    bubbles: true, clientX: from.x, clientY: from.y
  }));

  for (let i = 1; i <= steps; i++) {
    const x = from.x + (to.x - from.x) * (i / steps);
    const y = from.y + (to.y - from.y) * (i / steps);
    el.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, clientX: x, clientY: y
    }));
  }

  el.dispatchEvent(new PointerEvent("pointerup", {
    bubbles: true, clientX: to.x, clientY: to.y
  }));
}
