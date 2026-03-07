const METRICS = [
  "obligations_incurred",
  "gross_outlay_amount",
  "unobligated_balance",
  "total_budgetary_resources",
];

function toNumber(x) {
  const s = String(x ?? "").trim();
  if (!s) return 0;
  const n = Number(s.replace(/[, $]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function rowsToSunburstHierarchy(rows) {
  // function -> subfunction -> metric sums
  const agg = new Map();

  for (const r of rows) {
    const fn = (r.budget_function || "Unknown Function").trim();
    const sub = (r.budget_subfunction || "Unknown Subfunction").trim();

    if (!agg.has(fn)) agg.set(fn, new Map());
    const subMap = agg.get(fn);

    if (!subMap.has(sub)) {
      const init = Object.fromEntries(METRICS.map(m => [m, 0]));
      subMap.set(sub, init);
    }

    const sums = subMap.get(sub);
    for (const m of METRICS) sums[m] += toNumber(r[m]);
  }

  console.log(agg);
  
  return {
    name: "Budget",
    children: Array.from(agg, ([fn, subMap]) => ({
      name: fn,
      children: Array.from(subMap, ([sub, sums]) => ({
        name: sub,
        children: METRICS.map(m => ({ name: m, value: sums[m] })),
      })),
    })),
  };
}
