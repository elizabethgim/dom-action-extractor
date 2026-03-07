export function cssPath(el: Element, maxDepth = 4) {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let i = 0; i < maxDepth && cur; i++) {
    let part = cur.tagName.toLowerCase();
    const id = (cur as HTMLElement).id;
    if (id) part += `#${id}`;
    const cls = (cur as HTMLElement).className;
    if (cls && typeof cls === "string") {
      const first = cls.split(/\s+/).filter(Boolean).slice(0, 2);
      if (first.length) part += "." + first.join(".");
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}