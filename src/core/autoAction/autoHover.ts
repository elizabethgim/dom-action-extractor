export async function autoHover(el: Element, opts = {}) {
  if (!el) return;
  const base = { bubbles: true, cancelable: true, view: window, ...opts };
  el.dispatchEvent(new MouseEvent("mouseenter", base));
  el.dispatchEvent(new MouseEvent("mousemove", base));
}

export function autoUnhover(el: Element, opts = {}) {
  if (!el) return;
  el.dispatchEvent(new MouseEvent("mouseleave", {
    bubbles: true,
    cancelable: true,
    view: window,
    ...opts
  }));
}