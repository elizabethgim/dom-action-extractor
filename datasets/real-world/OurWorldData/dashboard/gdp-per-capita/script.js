import { createOwidDashboardIndex } from "../_shared/owidDashboardTemplate.js";

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/gdp-per-capita-maddison-project-database.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "GDP per capita",
  subtitle: "",
  source:   "",

  columns: { entity: "entity", code: "code", year: "year", value: "gdp_per_capita" },

  colorMode: "threshold",
  thresholds:      [1000, 5000, 15000, 30000, 50000],
  colors:          ["#fcfbfd", "#efedf5", "#dadaeb", "#bcbddc", "#9e9ac8", "#756bb1", "#54278f"],
  thresholdLabels: ["0", "1k", "5k", "15k", "30k", "50k"],

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
