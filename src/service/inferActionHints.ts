export function inferActionHints(el: HTMLElement): string[] {
  const hints: string[] = [];
  const tag = el.tagName.toLowerCase();

  const role = el.getAttribute("role") || "";
  const tabindex = el.getAttribute("tabindex");
  const ariaLabel = el.getAttribute("aria-label") || "";
  const style = window.getComputedStyle(el);
  const cursor = style.cursor;

  if (tag === "a" || tag === "button" || role === "button") hints.push("click");
  if (tabindex != null) hints.push("focus");
  if (cursor === "pointer") hints.push("click");
  if (cursor === "grab" || cursor === "grabbing") hints.push("drag/pan");

  const cls = (el.className || "").toString();
  if (/brush|handle|selection/i.test(cls)) hints.push("brush/drag");
  if (/zoom/i.test(cls)) hints.push("zoom");
  if (ariaLabel) hints.push(`aria:${ariaLabel.slice(0, 24)}`);

  // SVG specific
  if (tag === "path" || tag === "circle" || tag === "rect") hints.push("hover");

  return Array.from(new Set(hints));
}