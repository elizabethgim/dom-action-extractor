/*
  World Population — OWID-style choropleth map
  Data: UN World Population Prospects (2024) via OurWorldInData
*/
const CONFIG = {
  csvUrl:   "https://ourworldindata.org/grapher/population-with-un-projections.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "World Population",
  subtitle: "Total population by country, including UN projections.",
  source:   "UN, World Population Prospects (2024); OurWorldInData.org/population-growth | CC BY",

  columns: { entity: "entity", code: "code", year: "year", value: "population" },

  colorMode: "threshold",
  thresholds:      [1e6, 5e6, 10e6, 50e6, 1e8, 5e8, 1e9],
  thresholdLabels: ["<1M", "1M", "5M", "10M", "50M", "100M", "500M", "1B+"],
  colors: ["#f7fbff","#deebf7","#c6dbef","#9ecae1","#6baed6","#4292c6","#2171b5","#08306b"],

  noDataColor: "#e8e4dc",
  mapHeight:   560,
};
/* ─────────────────────────────────────────────────────────────────────────── */


/* ── Continent mapping ────────────────────────────────────────────────────── */
const CONTINENT_COLORS = {
  "Africa":        "#e07b39",
  "Asia":          "#4e79a7",
  "Europe":        "#59a14f",
  "North America": "#b07aa1",
  "South America": "#e15759",
  "Oceania":       "#76b7b2",
};

const _AF = new Set(["DZA","AGO","BEN","BWA","BFA","BDI","CMR","CPV","CAF","TCD","COM","COD","COG","CIV","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","KEN","LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA","STP","SEN","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN","UGA","ZMB","ZWE"]);
const _AS = new Set(["AFG","ARM","AZE","BHR","BGD","BTN","BRN","KHM","CHN","CYP","GEO","IND","IDN","IRN","IRQ","ISR","JPN","JOR","KAZ","KWT","KGZ","LAO","LBN","MYS","MDV","MNG","MMR","NPL","PRK","OMN","PAK","PSE","PHL","QAT","SAU","SGP","KOR","LKA","SYR","TJK","THA","TLS","TUR","TKM","ARE","UZB","VNM","YEM"]);
const _EU = new Set(["ALB","AND","AUT","BLR","BEL","BIH","BGR","HRV","CZE","DNK","EST","FIN","FRA","DEU","GRC","HUN","ISL","IRL","ITA","XKX","LVA","LIE","LTU","LUX","MLT","MDA","MCO","MNE","NLD","MKD","NOR","POL","PRT","ROU","RUS","SMR","SRB","SVK","SVN","ESP","SWE","CHE","UKR","GBR","VAT"]);
const _NA = new Set(["ATG","BHS","BRB","BLZ","CAN","CRI","CUB","DMA","DOM","SLV","GRD","GTM","HTI","HND","JAM","MEX","NIC","PAN","KNA","LCA","VCT","TTO","USA"]);
const _SA = new Set(["ARG","BOL","BRA","CHL","COL","ECU","GUY","PRY","PER","SUR","URY","VEN"]);
const _OC = new Set(["AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON","TUV","VUT"]);

function getContinentFromCode(code) {
  if (!code) return null;
  const c = code.toUpperCase();
  if (_AF.has(c)) return "Africa";
  if (_AS.has(c)) return "Asia";
  if (_EU.has(c)) return "Europe";
  if (_NA.has(c)) return "North America";
  if (_SA.has(c)) return "South America";
  if (_OC.has(c)) return "Oceania";
  return null;
}

/* ── Population formatter ─────────────────────────────────────────────────── */
function formatPop(v) {
  if (v == null) return "No data";
  if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1).replace(/\.?0+$/, "") + "M";
  if (v >= 1e3) return Math.round(v / 1e3) + "K";
  return String(Math.round(v));
}


/* ── Color helpers (derived from CONFIG) ──────────────────────────────────── */
const colorScale = d3.scaleThreshold().domain(CONFIG.thresholds).range(CONFIG.colors);

function colorByValue(v) {
  return v == null ? null : colorScale(v);
}
function labelByValue(v) {
  return v == null ? "No data" : formatPop(v);
}
function yDomain(values) {
  return [0, d3.max(values, d => d.value) || 1];
}
const lineCurve = d3.curveLinear;


/* ── Region bboxes for zoom ───────────────────────────────────────────────── */
const REGION_BBOX = {
  africa:   [[-20, -38], [55,  38]],
  americas: [[-170,-58], [-30, 75]],
  asia:     [[ 25, -12], [150, 75]],
  europe:   [[-28,  35], [50,  72]],
  oceania:  [[ 90, -50], [180, 25]],
};


/* ── App state ────────────────────────────────────────────────────────────── */
const state = {
  view: "map",
  minYear: null, maxYear: null, startYear: null, endYear: null,
  selected: new Set(), hovered: null, playing: false,
  rows: [], entities: [], entityMap: new Map(),
  byCode: new Map(), byCountryName: new Map(),
  world: null, features: [], centroids: new Map(),
  rangeActive: false, isZoomed: false, region: "world",
  activeContinents: new Set(Object.keys(CONTINENT_COLORS)),
};


/* ── DOM references ───────────────────────────────────────────────────────── */
const els = {
  titleText:        d3.select("#title-text"),
  titleYear:        d3.select("#title-year"),
  subtitle:         d3.select("#subtitle"),
  tabs:             d3.selectAll(".tab"),
  views:            d3.selectAll(".view"),
  mapSvg:           d3.select("#map-svg"),
  mapLeft:          d3.select("#map-left"),
  mapPair:          d3.select("#map-pair"),
  lineSvg:          d3.select("#line-svg"),
  tooltip:          d3.select("#map-tooltip"),
  countryList:      d3.select("#country-list"),
  selectedList:     d3.select("#selected-list"),
  selectionSection: d3.select("#selection-section"),
  countrySearch:    d3.select("#country-search"),
  tableSearch:      d3.select("#table-search"),
  startLabel:       d3.select("#start-label"),
  endLabel:         d3.select("#end-label"),
  sortYear:         d3.select("#sort-year"),
  selectionCount:   d3.select("#selection-count"),
  clearSelection:   d3.select("#clear-selection"),
  play:             d3.select("#play-button"),
  legend:           d3.select("#legend"),
  tableHead:        d3.select("#data-table thead"),
  tableBody:        d3.select("#data-table tbody"),
  sideTitle:        d3.select("#side-title"),
  compareBtn:       d3.select("#compare-btn"),
  zoomSelBtn:       d3.select("#zoom-sel-btn"),
  resetZoomBtn:     d3.select("#reset-zoom-btn"),
  regionSelect:     d3.select("#region-select"),
};


/* ── SVG slider state ─────────────────────────────────────────────────────── */
let sliderXScale = null, sliderW = 0;
const sliderR = 7, sliderTy = 14;
let sliderHoverG, sliderTipCircle, sliderTipBg, sliderTipTxt;


/* ── Bootstrap ────────────────────────────────────────────────────────────── */
init();

async function init() {
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  d3.select("#source-text").text(CONFIG.source || "");
  d3.select("title").text(CONFIG.title || "Map");

  drawLegend();
  buildContinentFilter();

  let csvRows, world;
  try {
    [csvRows, world] = await Promise.all([
      d3.csv(CONFIG.csvUrl, parseRow),
      d3.json(CONFIG.worldUrl),
    ]);
  } catch (e) {
    els.titleText.text("Error loading data — check console.");
    console.error(e);
    return;
  }

  state.rows     = csvRows.filter(d => d.entity && Number.isFinite(d.year));
  state.world    = world;
  state.features = topojson.feature(world, world.objects.countries).features
                     .filter(f => +f.id !== 10);

  buildIndexes();
  bindControls();
  renderAll();
  requestAnimationFrame(() => buildSlider());
}


/* ── Data parsing ─────────────────────────────────────────────────────────── */
function parseRow(d) {
  const c = CONFIG.columns;
  const raw = d[c.value];
  const value = raw !== "" && raw != null && !isNaN(+raw) ? +raw : null;
  return {
    entity: d[c.entity],
    code:   normalizeCode(d[c.code]),
    year:   +d[c.year],
    value,
  };
}


/* ── Indexes ─────────────────────────────────────────────────────────────── */
function buildIndexes() {
  const years = [...new Set(state.rows.map(d => d.year))].sort(d3.ascending);
  state.minYear   = d3.min(years);
  state.maxYear   = d3.max(years);
  state.startYear = state.minYear;
  state.endYear   = state.maxYear;

  const byEntity = d3.group(state.rows, d => d.entity);
  state.entities = [...byEntity.keys()].sort(d3.ascending).map(name => {
    const values = byEntity.get(name).sort((a, b) => d3.ascending(a.year, b.year));
    const code = values.find(d => d.code)?.code;
    return { name, code, continent: getContinentFromCode(code), values };
  });
  state.entityMap     = new Map(state.entities.map(d => [d.name, d]));
  state.byCode        = new Map();
  state.byCountryName = new Map();
  state.entities.forEach(e => {
    if (e.code) state.byCode.set(e.code, e);
    state.byCountryName.set(normName(e.name), e);
  });

  if (!state.selected.size) {
    ["China", "India", "United States", "Nigeria"]
      .forEach(n => { if (state.entityMap.has(n)) state.selected.add(n); });
    if (!state.selected.size) state.entities.filter(e => e.continent).slice(0, 4).forEach(d => state.selected.add(d.name));
  }

  state.centroids = new Map();
  state.features.forEach(f => {
    const ent = entityForFeature(f);
    if (ent) state.centroids.set(ent.name, d3.geoCentroid(f));
  });
}


/* ── Controls ────────────────────────────────────────────────────────────── */
function bindControls() {
  els.tabs.on("click", function () {
    state.view = this.dataset.view;
    els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
    els.views.classed("active", function () { return this.id === `${state.view}-view`; });
    els.sideTitle.text(state.view === "line" ? "ADD/REMOVE COUNTRIES AND REGIONS" : "SELECT COUNTRIES");
    renderAll();
  });

  els.countrySearch.on("input", renderCountryList);
  els.tableSearch.on("input",   renderTable);
  els.clearSelection.on("click", () => { state.selected.clear(); renderAll(); });
  els.play.on("click", togglePlay);

  window.addEventListener("resize", debounce(() => { renderAll(); buildSlider(); }, 120));

  const startEl = document.getElementById("start-input");
  const endEl   = document.getElementById("end-input");
  startEl.addEventListener("change",  e => commitStart(e.target.value));
  startEl.addEventListener("keydown", e => { if (e.key === "Enter") { commitStart(e.target.value); startEl.blur(); } });
  startEl.addEventListener("blur",    () => { startEl.style.display = "none"; });
  endEl.addEventListener("change",    e => commitEnd(e.target.value));
  endEl.addEventListener("keydown",   e => { if (e.key === "Enter") { commitEnd(e.target.value); endEl.blur(); } });
  endEl.addEventListener("blur",      () => { endEl.style.display = "none"; });

  els.compareBtn.on("click",   () => setRangeMode(!state.rangeActive));
  els.zoomSelBtn.on("click",   zoomToSel);
  els.resetZoomBtn.on("click", resetZoom);
  els.regionSelect.on("change", function () {
    state.region   = this.value;
    state.isZoomed = this.value !== "world";
    renderMap();
    showZoomControls();
  });
}


/* ── Render orchestration ─────────────────────────────────────────────────── */
function renderAll() {
  const yearTxt = state.view === "map" ? `, ${state.endYear}` : "";
  els.titleYear.text(yearTxt);
  els.sortYear.text(state.endYear);
  els.selectionSection.classed("hidden", !state.selected.size);
  els.selectionCount.text(`Selection (${state.selected.size})`);
  syncSliderHandles();
  renderCountryList();
  if (state.view === "map")   { renderMap();   showZoomControls(); }
  if (state.view === "table") renderTable();
  if (state.view === "line")  renderLine();
}

function renderCountryList() {
  const q = els.countrySearch.property("value").trim().toLowerCase();
  const allRows = state.entities
    .filter(e => e.continent)           // only actual countries
    .map(e => ({ ...e, current: valueAtYear(e.values, state.endYear) }))
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => d3.descending(a.current ?? -Infinity, b.current ?? -Infinity) || d3.ascending(a.name, b.name));

  renderCountryRows(els.selectedList,  allRows.filter(d =>  state.selected.has(d.name)));
  renderCountryRows(els.countryList,   allRows.filter(d => !state.selected.has(d.name)));
}

function renderCountryRows(container, rows) {
  const join = container.selectAll("label.country-row").data(rows, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("label").attr("class", "country-row");
  enter.append("input").attr("type", "checkbox");
  enter.append("span").attr("class", "country-name");
  enter.append("span").attr("class", "country-value");

  const merged = join.merge(enter);
  merged
    .classed("active", d => state.selected.has(d.name) || state.hovered === d.name)
    .on("mouseenter", (_, d) => { state.hovered = d.name; renderHoverEffects(); })
    .on("mouseleave", () => { state.hovered = null; renderHoverEffects(); })
    .on("click", (event, d) => {
      event.preventDefault();
      state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
      renderAll();
    });
  merged.select("input").property("checked", d => state.selected.has(d.name));
  merged.select(".country-name").text(d => d.name);
  merged.select(".country-value").text(d => d.current == null ? "" : formatPop(d.current));

  // Bar width: based on which threshold bin the value falls in
  merged.each(function(d) {
    const v = d.current;
    const binIdx = v == null ? 0 : CONFIG.thresholds.filter(t => v >= t).length;
    const pct = (binIdx / CONFIG.colors.length) * 100;
    this.style.setProperty("--bar-w", pct + "%");
  });
}


/* ── Projection ───────────────────────────────────────────────────────────── */
function makeProjection(width, height) {
  if (state.isZoomed && state.selected.size) {
    const features = state.features.filter(f => state.selected.has(entityForFeature(f)?.name));
    if (features.length) {
      return d3.geoNaturalEarth1().fitExtent(
        [[20, 12], [width - 20, height - 34]],
        { type: "FeatureCollection", features }
      );
    }
  }
  return makeRegionProj(state.region, width, height);
}

function makeRegionProj(region, width, height) {
  if (region === "world") {
    return d3.geoNaturalEarth1()
      .fitExtent([[10, 12], [width - 10, height - 34]], { type: "Sphere" });
  }
  const bbox = REGION_BBOX[region];
  if (!bbox) return makeRegionProj("world", width, height);
  const [[lon0, lat0], [lon1, lat1]] = bbox;
  return d3.geoNaturalEarth1().fitExtent(
    [[18, 12], [width - 18, height - 34]],
    { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[lon0,lat0],[lon1,lat0],[lon1,lat1],[lon0,lat1]] } }
  );
}


/* ── Range / comparison mode ──────────────────────────────────────────────── */
function setRangeMode(active) {
  state.rangeActive = active;
  els.mapPair.classed("range-mode", active);
  els.compareBtn.classed("active", active);
  d3.select("#slider-svg").select(".sl-left").style("display", active ? null : "none");
  if (!active) document.getElementById("start-input").style.display = "none";
  syncSliderHandles();
  requestAnimationFrame(() => renderMap());
}

function zoomToSel() {
  if (!state.selected.size) return;
  state.isZoomed = true;
  state.region   = "world";
  els.regionSelect.property("value", "world");
  renderMap(); showZoomControls();
}

function resetZoom() {
  state.isZoomed = false;
  state.region   = "world";
  els.regionSelect.property("value", "world");
  renderMap(); showZoomControls();
}

function showZoomControls() {
  els.zoomSelBtn.classed("hidden",   !state.selected.size || state.isZoomed);
  els.resetZoomBtn.classed("hidden", !state.isZoomed);
}


/* ── Map rendering ────────────────────────────────────────────────────────── */
function renderMap() {
  const node   = els.mapSvg.node();
  const width  = node.clientWidth || 1000;
  const height = CONFIG.mapHeight;
  const proj   = makeProjection(width, height);

  if (state.rangeActive) {
    els.mapLeft.attr("viewBox", [0, 0, width, height]);
    renderSingleMap(els.mapLeft, state.startYear, proj, "L");
    addYearLabel(els.mapLeft, state.startYear, width);
  }
  els.mapSvg.attr("viewBox", [0, 0, width, height]);
  renderSingleMap(els.mapSvg, state.endYear, proj, "R");
  if (state.rangeActive) addYearLabel(els.mapSvg, state.endYear, width);
  renderHoverEffects();
}

function renderSingleMap(svg, year, projection, side) {
  const path = d3.geoPath(projection);
  svg.selectAll("*").remove();

  const hatchId = `diagonalHatch-${side}`;
  const pat = svg.append("defs").append("pattern")
    .attr("id", hatchId).attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8).attr("height", 8);
  pat.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
  pat.append("path").attr("d", "M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2")
    .attr("stroke", "#cfcfcf").attr("stroke-width", 1);

  svg.append("g")
    .selectAll("path")
    .data(state.features)
    .join("path")
    .attr("class", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      const off = ent?.continent && !state.activeContinents.has(ent.continent);
      return `country${v == null ? " no-data" : ""}${off ? " continent-off" : ""}`;
    })
    .attr("d", path)
    .style("fill", d => {
      const ent = entityForFeature(d);
      if (ent?.continent && !state.activeContinents.has(ent.continent)) return "#e0e0e0";
      const v = ent ? valueAtYear(ent.values, year) : null;
      const c = v != null ? colorByValue(v) : null;
      return c || `url(#${hatchId})`;
    })
    .on("mouseenter", (event, d) => {
      const ent = entityForFeature(d);
      if (!ent) return;
      if (ent.continent && !state.activeContinents.has(ent.continent)) return;
      state.hovered = ent.name;
      showTooltip(event, ent, year);
      renderHoverEffects();
    })
    .on("mousemove", event => moveTooltip(event))
    .on("mouseleave", () => {
      state.hovered = null;
      els.tooltip.classed("hidden", true);
      renderHoverEffects();
    })
    .on("click", (_, d) => {
      const ent = entityForFeature(d);
      if (!ent) return;
      state.selected.has(ent.name) ? state.selected.delete(ent.name) : state.selected.add(ent.name);
      renderAll();
    });
}

function addYearLabel(svg, year, width) {
  const g = svg.append("g").style("pointer-events", "none");
  g.append("rect")
    .attr("x", width / 2 - 34).attr("y", 8)
    .attr("width", 68).attr("height", 26).attr("rx", 5)
    .attr("fill", "rgba(255,255,255,0.82)");
  g.append("text")
    .attr("x", width / 2).attr("y", 26)
    .attr("text-anchor", "middle")
    .attr("font-size", 17).attr("font-weight", 700).attr("fill", "#333")
    .text(year);
}


/* ── Hover effects ────────────────────────────────────────────────────────── */
function renderHoverEffects() {
  const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
  svgs.forEach(svg => {
    svg.selectAll(".country")
      .classed("hovered",  d => entityForFeature(d)?.name === state.hovered)
      .classed("selected", d => state.selected.has(entityForFeature(d)?.name))
      .classed("dimmed",   d => !!state.hovered && entityForFeature(d)?.name !== state.hovered);
  });
  d3.selectAll(".country-row")
    .classed("active", d => state.selected.has(d.name) || state.hovered === d.name);
}


/* ── Legend & bucket highlight ────────────────────────────────────────────── */
function drawLegend() {
  els.legend.html("");

  const noDataItem = els.legend.append("div").style("cursor", "pointer");
  noDataItem.append("div").text("No data");
  noDataItem.append("div").attr("class", "no-data-swatch");
  noDataItem
    .on("mouseenter", () => highlightBucket("nodata"))
    .on("mouseleave", clearBucketHighlight);

  const labels = CONFIG.thresholdLabels;
  const n      = CONFIG.colors.length;
  const wrap   = els.legend.append("div");
  wrap.append("div").attr("class", "legend-labels")
    .style("grid-template-columns", `repeat(${n}, 1fr)`)
    .selectAll("div").data(CONFIG.colors).join("div")
    .text((_, i) => labels[i] ?? "");
  wrap.append("div").attr("class", "legend-blocks")
    .style("grid-template-columns", `repeat(${n}, 1fr)`)
    .selectAll("div").data(CONFIG.colors).join("div")
    .attr("class", "legend-cell").style("background", d => d)
    .on("mouseenter", (_, d) => highlightBucket(d))
    .on("mouseleave", clearBucketHighlight);
}

function highlightBucket(value) {
  const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
  svgs.forEach(svg => {
    svg.classed("map-dimmed", true);
    const year = svg === els.mapLeft ? state.startYear : state.endYear;
    svg.selectAll(".country").classed("bucket-highlight", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      if (value === "nodata") return v == null;
      return v != null && colorByValue(v) === value;
    });
  });
}

function clearBucketHighlight() {
  [els.mapLeft, els.mapSvg].forEach(svg => {
    svg.classed("map-dimmed", false);
    svg.selectAll(".country").classed("bucket-highlight", false);
  });
}


/* ── Continent filter ─────────────────────────────────────────────────────── */
function buildContinentFilter() {
  const chips = d3.select("#filter-chips");

  Object.entries(CONTINENT_COLORS).forEach(([name, color]) => {
    const chip = chips.append("div")
      .attr("class", "filter-chip")
      .attr("data-continent", name)
      .on("click", () => toggleContinent(name));
    chip.append("div").attr("class", "filter-chip-dot").style("background", color);
    chip.append("span").text(name);
  });

  d3.select("#filter-all").on("click", () => {
    state.activeContinents = new Set(Object.keys(CONTINENT_COLORS));
    syncContinentChips();
    renderMap();
  });
  d3.select("#filter-none").on("click", () => {
    state.activeContinents = new Set();
    syncContinentChips();
    renderMap();
  });
}

function toggleContinent(name) {
  if (state.activeContinents.has(name)) state.activeContinents.delete(name);
  else state.activeContinents.add(name);
  syncContinentChips();
  renderMap();
}

function syncContinentChips() {
  d3.selectAll(".filter-chip").each(function() {
    d3.select(this).classed("off", !state.activeContinents.has(this.dataset.continent));
  });
}


/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function showTooltip(event, ent, year) {
  const v = valueAtYear(ent.values, year);
  els.tooltip.classed("hidden", false)
    .html(`<h3>${ent.name}</h3><div>${year}: <strong>${formatPop(v)}</strong></div><svg></svg>`);
  drawTinyLine(els.tooltip.select("svg"), ent.values, 260, 110, true, year);
  moveTooltip(event);
}

function moveTooltip(event) {
  const rect = document.getElementById("map-view").getBoundingClientRect();
  els.tooltip
    .style("left", `${event.clientX - rect.left + 16}px`)
    .style("top",  `${event.clientY - rect.top  + 16}px`);
}


/* ── Table ────────────────────────────────────────────────────────────────── */
function renderTable() {
  const q    = els.tableSearch.property("value").trim().toLowerCase();
  const rows = state.entities
    .filter(e => e.continent)
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .map(e => ({
      ...e,
      sv:     valueAtYear(e.values, state.startYear),
      ev:     valueAtYear(e.values, state.endYear),
      change: changeBetween(e.values, state.startYear, state.endYear),
    }))
    .sort((a, b) => d3.descending(a.ev ?? -Infinity, b.ev ?? -Infinity) || d3.ascending(a.name, b.name));

  els.tableHead.html(`<tr>
    <th>Country</th>
    <th>${state.startYear}</th>
    <th>${state.endYear}</th>
    <th>${state.minYear}–${state.maxYear}</th>
    <th>Change</th>
    <th>Relative change</th>
  </tr>`);

  const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("tr");
  enter.append("td").attr("class", "name-cell");
  enter.append("td").attr("class", "start-cell");
  enter.append("td").attr("class", "end-cell");
  enter.append("td").append("svg").attr("class", "sparkline");
  enter.append("td").attr("class", "abs-cell");
  enter.append("td").attr("class", "rel-cell");

  const merged = join.merge(enter);
  merged.select(".name-cell").text(d => d.name);
  merged.select(".start-cell").text(d => d.sv == null ? "" : formatPop(d.sv));
  merged.select(".end-cell").text(d => d.ev == null ? "" : formatPop(d.ev));
  merged.select(".abs-cell").text(d =>
    d.change == null ? "" : `${d.change >= 0 ? "+" : ""}${formatPop(Math.abs(d.change))}`);
  merged.select(".rel-cell").text(d =>
    d.sv ? d3.format("+.0%")((d.ev - d.sv) / Math.abs(d.sv)) : "");
  merged.select("svg").each(function (d) {
    drawTinyLine(d3.select(this), d.values, 150, 42, false);
  });
}


/* ── Line chart ───────────────────────────────────────────────────────────── */
function renderLine() {
  const svg    = els.lineSvg;
  const node   = svg.node();
  const width  = node.clientWidth || 1000;
  const height = 560;
  svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();

  const selected = state.selected.size
    ? [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean)
    : state.entities.filter(e => e.continent).slice(0, 4);

  const cols   = 2;
  const nRows  = Math.ceil(selected.length / cols);
  const cellW  = (width - 30) / cols;
  const cellH  = Math.max(170, (height - 80) / nRows);
  const margin = { top: 58, right: 16, bottom: 28, left: 52 };

  drawLineLegend(svg, width);

  selected.forEach((ent, i) => {
    const x0 = (i % cols) * cellW + 12;
    const y0 = Math.floor(i / cols) * cellH + 80;
    drawSmallMultiple(
      svg.append("g").attr("transform", `translate(${x0},${y0})`),
      ent, cellW - 30, cellH - 24, margin
    );
  });
}

function drawSmallMultiple(g, ent, w, h, margin) {
  const allValid = ent.values.filter(d => d.value != null);
  const inRange  = allValid.filter(d => d.year >= state.startYear && d.year <= state.endYear);

  const x = d3.scaleLinear().domain([state.startYear, state.endYear]).range([margin.left, w - margin.right]);
  const [yMin, yMax] = yDomain(allValid);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([h - margin.bottom, margin.top]);

  g.append("text").attr("class", "small-multiple-title")
    .attr("x", margin.left).attr("y", 22).text(ent.name);

  const gridVals = d3.ticks(yMin, yMax, 5);
  g.selectAll(".grid-line").data(gridVals).join("line").attr("class", "grid-line")
    .attr("x1", margin.left).attr("x2", w - margin.right)
    .attr("y1", d => y(d)).attr("y2", d => y(d));

  g.append("g").attr("transform", `translate(0,${h - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")).tickSizeOuter(0))
    .call(gg => gg.select(".domain").attr("stroke", "#aaa"));

  g.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(v => formatPop(v)).tickSize(0))
    .call(gg => gg.select(".domain").remove());

  const stroke = (colorByValue(valueAtYear(ent.values, state.endYear)) || "var(--axis-blue)");
  const line = d3.line().defined(d => d.value != null).curve(lineCurve)
    .x(d => x(d.year)).y(d => y(d.value));
  g.append("path").datum(inRange).attr("class", "line-path").attr("stroke", stroke).attr("d", line);
}

function drawTinyLine(svg, values, width, height, axes, markerYear) {
  svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();
  const m        = axes ? { top: 10, right: 10, bottom: 24, left: 40 } : { top: 5, right: 5, bottom: 5, left: 5 };
  const filtered = values.filter(d => d.year >= state.startYear && d.year <= state.endYear && d.value != null);
  const allValid = values.filter(d => d.value != null);
  const x        = d3.scaleLinear().domain([state.startYear, state.endYear]).range([m.left, width - m.right]);
  const [yMin, yMax] = yDomain(allValid);
  const y        = d3.scaleLinear().domain([yMin, yMax]).range([height - m.bottom, m.top]);
  if (axes) {
    svg.append("g").attr("transform", `translate(0,${height - m.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));
    svg.append("g").attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(v => formatPop(v)));
  }
  const line = d3.line().defined(d => d.value != null).curve(lineCurve)
    .x(d => x(d.year)).y(d => y(d.value));
  svg.append("path").datum(filtered)
    .attr("d", line).attr("fill", "none")
    .attr("stroke", "var(--axis-blue)").attr("stroke-width", axes ? 2.5 : 2);
  const yr  = markerYear ?? state.endYear;
  const dot = filtered.find(d => d.year === yr) || filtered.at(-1);
  if (dot) {
    svg.append("circle")
      .attr("cx", x(dot.year)).attr("cy", y(dot.value))
      .attr("r", axes ? 4 : 3).attr("fill", "var(--axis-blue)");
  }
}

function drawLineLegend(svg, width) {
  const items = CONFIG.colors.map((c, i) => ({ label: (CONFIG.thresholdLabels || [])[i] ?? "", color: c }));
  const itemW  = 72;
  const totalW = items.length * itemW;
  const g = svg.append("g")
    .attr("transform", `translate(${Math.max(20, width / 2 - totalW / 2)},28)`);
  items.forEach((item, i) => {
    g.append("rect").attr("x", i * itemW).attr("y", 8).attr("width", itemW - 2).attr("height", 7).attr("fill", item.color);
    g.append("text").attr("x", i * itemW).attr("y", 0).attr("fill", "#555").attr("font-size", 12).text(item.label);
  });
}


/* ── SVG Slider ───────────────────────────────────────────────────────────── */
function buildSlider() {
  const svgEl = document.getElementById("slider-svg");
  if (!svgEl || !state.minYear) return;
  const svgD3 = d3.select(svgEl);
  const w     = svgEl.getBoundingClientRect().width || 400;
  const h = 28, R = sliderR, ty = sliderTy;
  sliderW = w;
  svgD3.selectAll("*").remove();
  svgD3.attr("height", h);
  sliderXScale = d3.scaleLinear().domain([state.minYear, state.maxYear]).range([R, w - R]);

  const startEl = document.getElementById("start-input");
  const endEl   = document.getElementById("end-input");

  svgD3.append("rect").attr("x", R).attr("y", ty - 4).attr("width", w - 2 * R).attr("height", 8)
    .attr("rx", 4).attr("fill", "#ddd");

  svgD3.append("rect").attr("class", "sl-range")
    .attr("y", ty - 4).attr("height", 8).attr("rx", 4).attr("fill", "#3a6abf")
    .attr("x", 0).attr("width", 0).style("cursor", "grab")
    .call(d3.drag()
      .on("start", function () { d3.select(this).style("cursor", "grabbing"); })
      .on("drag", function (event) {
        if (!state.rangeActive) return;
        const span = state.endYear - state.startYear;
        const ns   = Math.round(sliderXScale.invert(sliderXScale(state.startYear) + event.dx));
        state.startYear = Math.max(state.minYear, Math.min(state.maxYear - span, ns));
        state.endYear   = state.startYear + span;
        syncSliderHandles(); renderAll();
      })
      .on("end", function () { d3.select(this).style("cursor", "grab"); }));

  sliderHoverG    = svgD3.append("g").style("display", "none").style("pointer-events", "none");
  sliderTipCircle = sliderHoverG.append("circle").attr("cy", ty).attr("r", R)
    .attr("fill", "#fff").attr("stroke", "#aaa").attr("stroke-width", 2);
  sliderTipBg  = sliderHoverG.append("rect").attr("rx", 4)
    .attr("fill", "#fff").attr("stroke", "#bbb").attr("stroke-width", 1);
  sliderTipTxt = sliderHoverG.append("text")
    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
    .attr("font-size", 13).attr("font-weight", 600).attr("fill", "#333");

  svgD3.append("circle").attr("class", "sl-right").attr("cy", ty).attr("r", R)
    .attr("fill", "#fff").attr("stroke", "#3a6abf").attr("stroke-width", 2).style("cursor", "ew-resize")
    .on("mouseover", () => { showInput(endEl); updateHoverTip(sliderXScale(state.endYear), true); })
    .on("mouseout",  () => { hideInput(endEl); sliderHoverG.style("display", "none"); })
    .call(d3.drag()
      .on("start", () => showInput(endEl))
      .on("drag", function (event) {
        state.endYear = clampYear(event.x, state.rangeActive ? state.startYear + 1 : state.minYear, state.maxYear);
        updateHoverTip(sliderXScale(state.endYear), true);
        syncSliderHandles(); renderAll();
      })
      .on("end", () => { hideInput(endEl); sliderHoverG.style("display", "none"); }));

  svgD3.append("circle").attr("class", "sl-left").attr("cy", ty).attr("r", R)
    .attr("fill", "#fff").attr("stroke", "#3a6abf").attr("stroke-width", 2)
    .style("cursor", "ew-resize").style("display", "none")
    .on("mouseover", () => { showInput(startEl); updateHoverTip(sliderXScale(state.startYear), true); })
    .on("mouseout",  () => { hideInput(startEl); sliderHoverG.style("display", "none"); })
    .call(d3.drag()
      .on("start", () => showInput(startEl))
      .on("drag", function (event) {
        const yr = clampYear(event.x, state.minYear, state.maxYear);
        if (yr >= state.endYear) { state.startYear = state.minYear; setRangeMode(false); }
        else state.startYear = yr;
        updateHoverTip(sliderXScale(state.startYear), true);
        syncSliderHandles(); renderAll();
      })
      .on("end", () => { hideInput(startEl); sliderHoverG.style("display", "none"); }));

  svgD3.style("cursor", "pointer")
    .on("mousemove", function (event) { updateHoverTip(d3.pointer(event)[0]); })
    .on("mouseleave", () => sliderHoverG.style("display", "none"))
    .on("click", function (event) {
      if (event.target.tagName === "circle") return;
      const x  = d3.pointer(event)[0];
      const yr = Math.round(sliderXScale.invert(Math.max(R, Math.min(w - R, x))));
      sliderHoverG.style("display", "none");
      if (yr < state.endYear) {
        state.startYear = yr;
        setRangeMode(true);
        syncSliderHandles();
        renderAll();
      }
    });

  syncSliderHandles();
}

function syncSliderHandles() {
  els.startLabel.text(state.startYear);
  els.endLabel.text(state.endYear);
  if (!sliderXScale) return;
  const svgD3 = d3.select("#slider-svg");
  const lx = sliderXScale(state.startYear), rx = sliderXScale(state.endYear);
  svgD3.select(".sl-left").attr("cx", lx);
  svgD3.select(".sl-right").attr("cx", rx);
  const rangeX = state.rangeActive ? lx : rx;
  svgD3.select(".sl-range").attr("x", rangeX).attr("width", Math.max(0, rx - rangeX));
  const startEl = document.getElementById("start-input");
  const endEl   = document.getElementById("end-input");
  if (startEl) startEl.value = state.startYear;
  if (endEl)   endEl.value   = state.endYear;
}

function updateHoverTip(x, force = false) {
  if (!sliderXScale || !sliderHoverG) return;
  if (state.rangeActive && !force) { sliderHoverG.style("display", "none"); return; }
  const yr = Math.round(sliderXScale.invert(Math.max(sliderR, Math.min(sliderW - sliderR, x))));
  const lbl = String(yr), tw = lbl.length * 7.5 + 14, th = 22;
  const cx = Math.max(tw / 2 + 2, Math.min(sliderW - tw / 2 - 2, x));
  const hx = Math.max(sliderR, Math.min(sliderW - sliderR, x));
  sliderTipCircle.attr("cx", hx);
  sliderTipBg.attr("x", cx - tw / 2).attr("y", sliderTy - th - 6).attr("width", tw).attr("height", th);
  sliderTipTxt.attr("x", cx).attr("y", sliderTy - th / 2 - 6).text(lbl);
  sliderHoverG.style("display", null);
}

function clampYear(screenX, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.round(sliderXScale.invert(screenX))));
}
function showInput(el) { if (el) el.style.display = ""; }
function hideInput(el) { if (el && document.activeElement !== el) el.style.display = "none"; }

function commitStart(raw) {
  const y = parseInt(raw, 10);
  if (isNaN(y)) { syncSliderHandles(); return; }
  state.startYear = Math.max(state.minYear, Math.min(state.endYear - 1, y));
  syncSliderHandles(); renderAll();
}
function commitEnd(raw) {
  const y = parseInt(raw, 10);
  if (isNaN(y)) { syncSliderHandles(); return; }
  state.endYear = Math.max(state.rangeActive ? state.startYear + 1 : state.minYear, Math.min(state.maxYear, y));
  syncSliderHandles(); renderAll();
}


/* ── Playback ─────────────────────────────────────────────────────────────── */
function togglePlay() {
  state.playing = !state.playing;
  els.play.text(state.playing ? "❚❚" : "▶");
  if (!state.playing) return;
  const timer = d3.interval(() => {
    if (!state.playing) return timer.stop();
    if (state.rangeActive) {
      const span = state.endYear - state.startYear;
      if (state.endYear >= state.maxYear) {
        timer.stop(); state.playing = false; els.play.text("▶");
      } else {
        state.startYear = Math.min(state.startYear + 1, state.maxYear - span);
        state.endYear   = state.startYear + span;
      }
    } else {
      if (state.endYear >= state.maxYear) {
        timer.stop(); state.playing = false; els.play.text("▶");
      } else {
        state.endYear += 1;
      }
    }
    renderAll();
  }, 300);
}


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
