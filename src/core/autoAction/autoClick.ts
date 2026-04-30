export async function autoClick(el: Element, opts = {}) {
  if (!el) return;
  
  const base = {
    bubbles: true,
    cancelable: true,
    view: window,
    ...opts
  };

  el.dispatchEvent(new MouseEvent("click", base));
}