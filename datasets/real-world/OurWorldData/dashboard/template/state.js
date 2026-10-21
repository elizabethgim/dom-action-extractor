/* ── App state ────────────────────────────────────────────────────────────── */
const state = {
  view: "map",
  minYear: null, maxYear: null, startYear: null, endYear: null,
  selected: new Set(),      // Line / Bar / Table selection
  mapSelected: new Set(),   // Map-only selection
  mekkoSelected: new Set(), // Marimekko-only selection
  hovered: null, playing: false,
  rows: [], entities: [], entityMap: new Map(),
  byCode: new Map(), byCountryName: new Map(),
  world: null, features: [], centroids: new Map(),
  isZoomed: false, rangeActive: false, region: "world",
  tableFilter: "countries",
};

// Returns the selection set for the current view (each view is independent).
function activeSelection() {
  if (state.view === "map")   return state.mapSelected;
  if (state.view === "mekko") return state.mekkoSelected;
  return state.selected;
}
