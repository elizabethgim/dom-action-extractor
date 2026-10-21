/* ── Utilities ────────────────────────────────────────────────────────────── */
function valueAtYear(values, year) {
  const exact = values.find(d => d.year === year);
  if (exact) return exact.value;
  return values.filter(d => d.year <= year && d.value != null).at(-1)?.value ?? null;
}

function changeBetween(values, a, b) {
  const av = valueAtYear(values, a), bv = valueAtYear(values, b);
  return av == null || bv == null ? null : bv - av;
}

function entityForFeature(feature) {
  const id = normalizeCode(feature.id);
  return state.byCode.get(id) ?? state.byCountryName.get(normName(feature.properties?.name || ""));
}

/* Stable key for any feature — entity name if known, else "#<iso-id>" */
function featureKey(feature) {
  return entityForFeature(feature)?.name ?? `#${normalizeCode(feature.id)}`;
}

function normalizeCode(code) {
  if (code == null) return "";
  const s = String(code).trim();
  return /^\d+$/.test(s) ? String(+s).padStart(3, "0") : s.toUpperCase();
}

function normName(s) {
  return String(s).toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
