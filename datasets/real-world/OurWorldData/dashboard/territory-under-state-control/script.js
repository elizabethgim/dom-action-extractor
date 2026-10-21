import { createOwidDashboardIndex } from "../_shared/owidDashboardTemplate.js";

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/percentage-of-territory-controlled-by-government.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Territory under state control",
  subtitle: "", // TODO: add subtitle
  source:   "", // TODO: add data source

  columns: { entity: "entity", code: "code", year: "year", value: "terr_contr_vdem__estimate_best" },

  colorMode: "threshold",
  thresholds:      [10, 25, 50, 75, 100],
  colors:          ["#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6", "#3182bd", "#08519c"],
  thresholdLabels: ["0", "10", "25", "50", "75", "100"],

  noDataColor:     "#e8e4dc",
  initialSelected: ["World", "United States", "China", "India", "Germany", "France", "Brazil"],
  mapHeight:       560,
};

export const index = createOwidDashboardIndex(CONFIG);

// Standalone mode: index.html provides an empty <div id="standalone-root">
// and loads this file as <script type="module">. The bundled app never
// creates an element with that id — it calls index(container) itself via
// the d3Adapter — so this never double-mounts inside the React system.
const standaloneRoot = document.getElementById("standalone-root");
if (standaloneRoot) index(standaloneRoot);
