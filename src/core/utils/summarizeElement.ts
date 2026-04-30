export function summarizeElement(el: Element): string{
  const tag= el.tagName.toLocaleLowerCase();
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}`: "";
  const classRaw = (el as HTMLElement).className? `.${(el as HTMLElement).id}`: "";

  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50);

  return `${tag}${id}${classRaw}${text ? ` text="${text}"` : ""}`;

}