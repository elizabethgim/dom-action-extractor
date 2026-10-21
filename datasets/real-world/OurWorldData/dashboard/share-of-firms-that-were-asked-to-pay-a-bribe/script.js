import { createOwidDashboardIndex } from "../_shared/owidDashboardTemplate.js";

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/bribery-incidence-for-firms.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Share of firms that were asked to pay a bribe",
  subtitle: "", // TODO: add subtitle
  source:   "", // TODO: add data source

  columns: { entity: "entity", code: "code", year: "year", value: "bribery_incidence__percent_of_firms_experiencing_at_least_one_bribe_payment_request" },

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
