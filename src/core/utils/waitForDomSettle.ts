/**
 * Waits until the DOM inside `target` has been quiet (no new mutations)
 * for `debounce` ms, or until `timeout` ms has elapsed — whichever comes first.
 *
 * Usage:
 *   await waitForDomSettle(container);            // default debounce 150ms, timeout 2000ms
 *   await waitForDomSettle(container, { debounce: 100, timeout: 3000 });
 */
export function waitForDomSettle(
  target: HTMLElement,
  {
    debounce = 150,
    timeout = 2000,
  }: { debounce?: number; timeout?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const done = () => {
      if (timer !== null) clearTimeout(timer);
      observer.disconnect();
      resolve();
    };

    // Start the fallback timeout immediately
    const fallback = setTimeout(done, timeout);

    const reschedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        clearTimeout(fallback);
        done();
      }, debounce);
    };

    const observer = new MutationObserver(reschedule);
    observer.observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });

    // Kick off the debounce timer immediately in case there are no mutations at all
    reschedule();
  });
}
