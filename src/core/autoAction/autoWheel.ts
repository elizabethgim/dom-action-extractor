export async function autoWheel(el: Element, deltaY = -1000, opts = {}) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const clientX = rect.left + rect.width / 2;
  const clientY = rect.top + rect.height / 2;

  el.dispatchEvent(new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY,
    clientX,
    clientY,
    view: window,
    ...opts
  }));
}

export function debugWheelOnce() {
  const h = (e: WheelEvent) => {
    console.log("[wheel caught]", {
      target: (e.target as Element)?.tagName,
      currentTarget: (e.currentTarget as any)?.tagName ?? e.currentTarget,
      deltaY: e.deltaY,
      deltaMode: e.deltaMode,
      bubbles: e.bubbles,
      cancelable: e.cancelable,
      isTrusted: e.isTrusted,
      defaultPrevented: e.defaultPrevented,
    });
  };
  document.addEventListener("wheel", h, true); // capture
  setTimeout(() => document.removeEventListener("wheel", h, true), 5000);
}
