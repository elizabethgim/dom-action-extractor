/*
  OWID-style D3 choropleth map — reusable template.

  Supports two color modes:
    "threshold"   — continuous numeric data bucketed by threshold values
    "categorical" — integer category values (0, 1, 2, … N)

  ─────────────────────────────────────────────────────────────────────────────
  CONFIGURE BELOW — only this block needs editing per dataset.
  ─────────────────────────────────────────────────────────────────────────────
*/
const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/electoral-democracy-index.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Electoral Democracy Index",
  subtitle: "Data by V-Dem. Expert estimates of the extent to which political leaders are elected under comprehensive voting rights in free and fair elections, and freedoms of association and expression are guaranteed. The index ranges from 0 to 1 (most democratic).",
  source:   "V-Dem (2026)",

  columns: { entity: "entity", code: "code", year: "year", value: "electdem_vdem__estimate_best" },

  colorMode: "threshold",
  // Data is on 0–1 scale; 9 thresholds → 10 color buckets
  thresholds:      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  // YlGnBu-style: pale yellow → green → teal → navy (matches OWID original)
  colors: [
    "#ffffd9", // < 0.1
    "#edf8b1", // 0.1 – 0.2
    "#c7e9b4", // 0.2 – 0.3
    "#7fcdbb", // 0.3 – 0.4
    "#41b6c4", // 0.4 – 0.5
    "#1d91c0", // 0.5 – 0.6
    "#225ea8", // 0.6 – 0.7
    "#253494", // 0.7 – 0.8
    "#0e1d6a", // 0.8 – 0.9
    "#081d58", // ≥ 0.9
  ],
  thresholdLabels: ["0", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9"],

  noDataColor:     "#e8e4dc",
  initialSelected: ["World", "United States", "China", "India", "Germany", "France", "Brazil"],
  mapHeight:       560,
};
/* ─────────────────────────────────────────────────────────────────────────── */


/* ── Region bboxes for zoom ───────────────────────────────────────────────── */
const REGION_BBOX = {
  africa:       [[-20, -38], [ 55,  38]],
  northamerica: [[-170,  5], [-52,  75]],
  southamerica: [[-82, -58], [-34,  15]],
  asia:         [[ 25, -12], [150,  75]],
  europe:       [[-28,  35], [ 50,  72]],
  oceania:      [[ 90, -50], [180,  25]],
};
