type Listener = EventListenerOrEventListenerObject;
export type Registry = Map<Element, Partial<Record<string, Set<Listener>>>>;

let installed = false;
let uninstallFn: (() => void) | null = null;

const registry: Registry = new Map();

export async function hook() {
  if (installed) return;
  installed = true;

  const origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (...args: Parameters<typeof origAdd>) {
    const [evtType, listener] = args;

    if (listener && this instanceof Element) {
      let m = registry.get(this);
      if (!m) { m = {}; registry.set(this, m); }
      (m[evtType] ??= new Set()).add(listener);
    }
    return origAdd.apply(this, args);
  };

  uninstallFn = () => {
    if (!installed || !origAdd) return;

    EventTarget.prototype.addEventListener = origAdd;
    installed = false;

    console.log("[hook] uninstalled");
  }

  console.log("[hook] installed");
}

export function getHookRegistry() {
  return registry;
}

export function clearHookRegistry() {
  registry.clear();
}

export function uninstallHook() {
  uninstallFn?.();
}
