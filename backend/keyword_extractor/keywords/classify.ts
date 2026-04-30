
export function classify(text: string) {
  const lower = text.toLowerCase();
  if (/(19|20)\d{2}/.test(lower)) return "TIME";
  if (["average","mean"].some(k => lower.includes(k))) return "AGG_AVG";
  if (["highest","max","most"].some(k => lower.includes(k))) return "AGG_MAX";
  if (["lowest","min","least"].some(k => lower.includes(k))) return "AGG_MIN";
  return "TERM";
}