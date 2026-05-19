export async function autoClick(el: Element, opts: MouseEventInit = {}) {
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const base: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: cx,
    clientY: cy,
    screenX: cx,
    screenY: cy,
    ...opts,
  };

  el.dispatchEvent(new MouseEvent("click", base));
}