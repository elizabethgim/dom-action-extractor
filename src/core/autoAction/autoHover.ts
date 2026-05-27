export async function autoHover(el: Element, eventType: string = "mouseenter") {
  if (!el) return;
  const base = { bubbles: true, cancelable: true, view: window };
  el.dispatchEvent(new MouseEvent(eventType, base));
  el.dispatchEvent(new MouseEvent("mousemove", base));
}

export function autoUnhover(el: Element) {
  if (!el) return;
  el.dispatchEvent(new MouseEvent("mouseleave", {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}
