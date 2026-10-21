/* ── Color helpers (derived from CONFIG) ──────────────────────────────────── */
const colorScale = CONFIG.colorMode === "threshold"
  ? d3.scaleThreshold().domain(CONFIG.thresholds).range(CONFIG.colors)
  : null;
const categoryMap = CONFIG.colorMode === "categorical"
  ? new Map((CONFIG.categories || []).map(d => [d.value, d]))
  : new Map();

function colorByValue(v) {
  if (v == null) return null;
  return CONFIG.colorMode === "threshold"
    ? colorScale(v)
    : categoryMap.get(+v)?.color ?? null;
}
function labelByValue(v) {
  if (v == null) return "No data";
  return CONFIG.colorMode === "threshold"
    ? v.toLocaleString()
    : categoryMap.get(+v)?.label ?? "No data";
}
function yDomain(values) {
  if (CONFIG.colorMode === "categorical") {
    return [0, (CONFIG.categories?.length ?? 4) - 1];
  }
  return [0, d3.max(values, d => d.value) || 1];
}
const lineCurve = CONFIG.colorMode === "categorical" ? d3.curveStepAfter : d3.curveLinear;


/* ── Line colors (per-entity palette) ────────────────────────────────────── */
const LINE_COLORS = [
  "#b13507", "#c05917", "#286fa8", "#6d3e91", "#996d39",
  "#2d8168", "#8c4569", "#3b8558", "#be5915", "#283a68",
  "#5e8e31", "#b2559a", "#1b6b88", "#883039", "#3d6b99",
];

function entityLineColor(name, entities) {
  const idx = entities.findIndex(e => e.name === name);
  return LINE_COLORS[idx >= 0 ? idx % LINE_COLORS.length : 0];
}

function fmtVal(v) {
  if (v == null) return "";
  if (v >= 1000) return (v / 1000).toFixed(2).replace(/\.?0+$/, "") + "k";
  return v.toLocaleString();
}


/* ── Marimekko continent data ─────────────────────────────────────────────── */
const CONTINENT_BY_CODE = new Map([
  ...["DZA","AGO","BEN","BWA","BFA","BDI","CMR","CPV","CAF","TCD","COM","COG","COD","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA","STP","SEN","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN","UGA","ZMB","ZWE"].map(c => [c, "Africa"]),
  ...["AFG","ARM","AZE","BHR","BGD","BTN","BRN","KHM","CHN","GEO","HKG","IND","IDN","IRN","IRQ","ISR","JPN","JOR","KAZ","KWT","KGZ","LAO","LBN","MYS","MDV","MNG","MMR","NPL","PRK","OMN","PAK","PSE","PHL","QAT","SAU","SGP","KOR","LKA","SYR","TWN","TJK","THA","TLS","TUR","TKM","ARE","UZB","VNM","YEM"].map(c => [c, "Asia"]),
  ...["ALB","AND","AUT","BLR","BEL","BIH","BGR","HRV","CYP","CZE","DNK","EST","FIN","FRA","DEU","GRC","HUN","ISL","IRL","ITA","XKX","LVA","LIE","LTU","LUX","MKD","MLT","MDA","MCO","MNE","NLD","NOR","POL","PRT","ROU","RUS","SMR","SRB","SVK","SVN","ESP","SWE","CHE","UKR","GBR","VAT"].map(c => [c, "Europe"]),
  ...["ATG","BHS","BRB","BLZ","CAN","CRI","CUB","DMA","DOM","SLV","GRD","GTM","HTI","HND","JAM","MEX","NIC","PAN","KNA","LCA","VCT","TTO","USA"].map(c => [c, "North America"]),
  ...["ARG","BOL","BRA","CHL","COL","ECU","GUY","PRY","PER","SUR","URY","VEN"].map(c => [c, "South America"]),
  ...["AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON","TUV","VUT"].map(c => [c, "Oceania"]),
]);

const CONTINENT_COLORS = {
  "North America": "#e05b24",
  "South America": "#932834",
  "Africa":        "#9a5b88",
  "Europe":        "#4c6a9c",
  "Asia":          "#00847e",
  "Oceania":       "#5ab7c7",
};
const CONTINENT_ORDER = ["North America", "South America", "Africa", "Europe", "Asia", "Oceania"];

function continentOf(entity) {
  return entity?.code ? CONTINENT_BY_CODE.get(entity.code) ?? null : null;
}
