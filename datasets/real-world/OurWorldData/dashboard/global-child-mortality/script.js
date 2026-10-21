import { createOwidDashboardIndex } from "../_shared/owidDashboardTemplate.js";

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/global-child-mortality-timeseries.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Global child mortality",
  subtitle: "", // TODO: add subtitle
  source:   "", // TODO: add data source

  columns: { entity: "entity", code: "code", year: "year", value: "share_surviving_first_five_years" },

  colorMode: "threshold",
  thresholds:      [5, 10, 50, 100, 200, 500],
  colors:          ["#fff5eb", "#fee6ce", "#fdd0a2", "#fdae6b", "#fd8d3c", "#d94801", "#8c2d04"],
  thresholdLabels: ["0", "5", "10", "50", "100", "200", "500"],

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
