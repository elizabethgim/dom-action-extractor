import { createOwidDashboardIndex } from "../_shared/owidDashboardTemplate.js";

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/number-with-without-clean-cooking-fuels.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Number of people with and without access to clean cooking fuels, World",
  subtitle: "", // TODO: add subtitle
  source:   "", // TODO: add data source

  columns: { entity: "entity", code: "code", year: "year", value: "eg_cft_accs_zs_number" },

  colorMode: "threshold",
  thresholds:      [10, 25, 50, 75, 90],
  colors:          ["#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476", "#31a354", "#006d2c"],
  thresholdLabels: ["0", "10", "25", "50", "75", "90"],

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
