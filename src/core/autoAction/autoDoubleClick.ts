export type MouseLikeOpts = Partial<MouseEventInit> & {
  delayMs?: number; // optional delay between clicks
};

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

function dispatchMouse(el: Element, type: string, init: MouseEventInit) {
  el.dispatchEvent(new MouseEvent(type, init));
}

export async function autoDoubleClick(el: Element, opts: MouseLikeOpts = {}) {
  console.log(el);
  if (!el) return;

  const {
    delayMs = 30,
    ...eventOpts
  } = opts;

  const base: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    button: 0,
    buttons: 1,
    detail: 1,
    ...eventOpts,
  };

  console.log(el);
  
  // First click sequence
  dispatchMouse(el, "pointerdown", base);
  dispatchMouse(el, "mousedown", base);
  dispatchMouse(el, "pointerup", { ...base, buttons: 0 });
  dispatchMouse(el, "mouseup", { ...base, buttons: 0 });
  dispatchMouse(el, "click", { ...base, detail: 1 });

  await sleep(delayMs);

  // Second click sequence (detail increments)
  dispatchMouse(el, "pointerdown", { ...base, detail: 2 });
  dispatchMouse(el, "mousedown", { ...base, detail: 2 });
  dispatchMouse(el, "pointerup", { ...base, detail: 2, buttons: 0 });
  dispatchMouse(el, "mouseup", { ...base, detail: 2, buttons: 0 });
  dispatchMouse(el, "click", { ...base, detail: 2 });

  // The actual dblclick event
  dispatchMouse(el, "dblclick", { ...base, detail: 2 });
}
