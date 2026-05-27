export async function captureWithHighlight<T>(
  el: Element,
  fn: () => Promise<T>
): Promise<T> {
  const s = (el as HTMLElement).style;
  const prevOutline = s.outline;
  const prevOutlineOffset = s.outlineOffset;

  s.outline = "3px solid #ef4444";
  s.outlineOffset = "2px";

  try {
    return await fn();
  } finally {
    s.outline = prevOutline;
    s.outlineOffset = prevOutlineOffset;
  }
}
