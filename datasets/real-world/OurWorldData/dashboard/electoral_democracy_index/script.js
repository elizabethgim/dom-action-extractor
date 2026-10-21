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


/* ── Region bboxes for zoom ───────────────────────────────────────────────── */

const REGION_BBOX = {
  africa:       [[-20, -38], [ 55,  38]],
  northamerica: [[-170,  5], [-52,  75]],
  southamerica: [[-82, -58], [-34,  15]],
  asia:         [[ 25, -12], [150,  75]],
  europe:       [[-28,  35], [ 50,  72]],
  oceania:      [[ 90, -50], [180,  25]],
};

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


/* ── DOM references ───────────────────────────────────────────────────────── */
const els = {
  titleText:     d3.select("#title-text"),
  titleYear:     d3.select("#title-year"),
  subtitle:      d3.select("#subtitle"),
  tabs:          d3.selectAll(".tab"),
  views:         d3.selectAll(".view"),
  mapSvg:        d3.select("#map-svg"),
  mapLeft:       d3.select("#map-left"),
  mapPair:       d3.select("#map-pair"),
  lineSvg:       d3.select("#line-svg"),
  tooltip:       d3.select("#map-tooltip"),
  countryList:      d3.select("#country-list"),
  selectedList:     d3.select("#selected-list"),
  selectionSection: d3.select("#selection-section"),
  countrySearch: d3.select("#country-search"),
  tableSearch:   d3.select("#table-search"),
  startLabel:    d3.select("#start-label"),
  endLabel:      d3.select("#end-label"),
  sortYear:      d3.select("#sort-year"),
  selectionCount:  d3.select("#selection-count"),
  clearSelection:  d3.select("#clear-selection"),
  play:          d3.select("#play-button"),
  legend:        d3.select("#legend"),
  tableHead:     d3.select("#data-table thead"),
  tableBody:     d3.select("#data-table tbody"),
  sideTitle:     d3.select("#side-title"),
  zoomSelBtn:    d3.select("#zoom-sel-btn"),
  resetViewBtn:  d3.select("#reset-view-btn"),
  regionSelect:  d3.select("#region-select"),
  mekkoSvg:      d3.select("#mekko-svg"),
  mekkoTooltip:  d3.select("#mekko-tooltip"),
  slopeSvg: d3.select("#slope-svg"),
};


/* ── Bootstrap ────────────────────────────────────────────────────────────── */
init();

async function init() {
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  d3.select("#source-text").text(CONFIG.source || "");
  d3.select("title").text(CONFIG.title || "Map");

  drawLegend();

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
                     .filter(f => +f.id !== 10); /* exclude Antarctica */

  buildIndexes();
  bindControls();
  renderAll();
  initSlider();
}


/* ── Data parsing ─────────────────────────────────────────────────────────── */
function parseRow(d) {
  const c = CONFIG.columns;
  const raw = d[c.value];
  let value = null;
  if (raw !== "" && raw != null) {
    const v = +raw;
    if (!isNaN(v)) {
      if (CONFIG.colorMode === "categorical") {
        const maxCat = (CONFIG.categories?.length ?? 4) - 1;
        if (v === Math.round(v) && v >= 0 && v <= maxCat) {
          value = v;
        } else if (v >= 0 && v <= 1) {
          /* bin decimal 0–1 into category indices */
          value = Math.min(maxCat, Math.floor(v * (maxCat + 1)));
        }
      } else {
        value = v;
      }
    }
  }
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
    return { name, code: values.find(d => d.code)?.code, values };
  });
  state.entityMap     = new Map(state.entities.map(d => [d.name, d]));
  state.byCode        = new Map();
  state.byCountryName = new Map();
  state.entities.forEach(e => {
    if (e.code) state.byCode.set(e.code, e);
    state.byCountryName.set(normName(e.name), e);
  });

  if (CONFIG.initialSelected?.length) {
    CONFIG.initialSelected.forEach(name => {
      if (state.entityMap.has(name)) state.selected.add(name);
    });
  }
  if (!state.selected.size) state.entities.slice(0, 4).forEach(d => state.selected.add(d.name));

  state.centroids = new Map();
  state.features.forEach(f => {
    const ent = entityForFeature(f);
    if (ent) state.centroids.set(ent.name, d3.geoCentroid(f));
  });
}


/* ── Controls ────────────────────────────────────────────────────────────── */
function switchView(view) {
  state.view = view;
  els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
  els.views.classed("active", function () { return this.id === `${state.view}-view`; });
  const lineOrBar = v => v === "line" || v === "bar";
  els.sideTitle.text(lineOrBar(state.view) ? "ADD/REMOVE COUNTRIES AND REGIONS" : "SELECT COUNTRIES");
  d3.select(".side-panel").classed("hidden", state.view === "table");
  showMapControls();
  renderAll();
}

function bindControls() {
  els.tabs.on("click", function (event) {
    // +3 button always just toggles the dropdown (never gets a view assigned)
    if (this.id === "tab-more-btn") {
      event.stopPropagation();
      document.getElementById("tab-dropdown").classList.toggle("visible");
      return;
    }
    const view = this.dataset.view;
    if (!view) return;
    document.getElementById("tab-dropdown")?.classList.remove("visible");
    switchView(view);
  });

  // Dropdown item click: swap it with the last-slot tab, then activate
  d3.selectAll(".tab-dropdown-item").on("click", function (event) {
    event.stopPropagation();
    const lastTab    = document.getElementById("last-slot-tab");
    const newView    = this.dataset.view;
    const newLabel   = this.textContent;
    // The evicted tab goes into the dropdown item's slot
    this.dataset.view = lastTab.dataset.view;
    this.textContent  = lastTab.textContent;
    // The chosen tab takes the last slot
    lastTab.dataset.view = newView;
    lastTab.textContent  = newLabel;
    document.getElementById("tab-dropdown").classList.remove("visible");
    switchView(newView);
  });

  // Close dropdown on any outside click
  document.addEventListener("click", () => {
    document.getElementById("tab-dropdown")?.classList.remove("visible");
  });

  els.countrySearch.on("input", renderCountryList);
  els.tableSearch.on("input",   renderTable);
  d3.select("#table-filter-select").on("change", function () {
    state.tableFilter = this.value;
    renderTable();
  });
  els.clearSelection.on("click", () => { activeSelection().clear(); renderAll(); });
  els.play.on("click", togglePlay);

  window.addEventListener("resize", debounce(renderAll, 120));

  els.zoomSelBtn.on("click",  zoomToSel);
  els.resetViewBtn.on("click", resetView);
  els.regionSelect.on("change", function () {
    state.region   = this.value;
    state.isZoomed = false;  // region dropdown uses flat projection, not orthographic globe
    renderMap();
    showMapControls();
  });
}


/* ── Render orchestration ─────────────────────────────────────────────────── */
function renderAll() {
  const yearTxt = (state.view === "map" || state.view === "bar" || state.view === "mekko") ? `, ${state.endYear}` : "";
  els.titleYear.text(yearTxt);
  els.sortYear.text(state.endYear);
  els.selectionSection.classed("hidden", !activeSelection().size);
  els.selectionCount.text(`Selection (${activeSelection().size})`);
  syncSliderHandles();
  d3.select(".side-panel").classed("hidden", state.view === "table");
  renderCountryList();
  
  if (state.view === "map")   { renderMap();   showMapControls(); }
  if (state.view === "table") renderTable();
  if (state.view === "line")  renderLine();
  if (state.view === "bar")   renderBar();
  if (state.view === "mekko") renderMekko();
  if (state.view === "slope") renderSlope();
}

function renderCountryList() {
  const q = els.countrySearch.property("value").trim().toLowerCase();
  const allRows = state.entities
    .map(e => ({ ...e, current: valueAtYear(e.values, state.endYear) }))
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .sort((a, b) => d3.descending(a.current ?? -Infinity, b.current ?? -Infinity) || d3.ascending(a.name, b.name));

  const sel = activeSelection();
  renderCountryRows(els.selectedList,  allRows.filter(d =>  sel.has(d.name)));
  renderCountryRows(els.countryList,   allRows.filter(d => !sel.has(d.name)));
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
    .classed("active", d => activeSelection().has(d.name) || state.hovered === d.name)
    .on("mouseenter", (_, d) => { state.hovered = d.name; renderHoverEffects(); })
    .on("mouseleave", () => { state.hovered = null; renderHoverEffects(); })
    .on("click", (event, d) => {
      event.preventDefault();
      const sel = activeSelection();
      sel.has(d.name) ? sel.delete(d.name) : sel.add(d.name);
      renderAll();
    });
  merged.select("input").property("checked", d => activeSelection().has(d.name));
  merged.select(".country-name").text(d => d.name);
  merged.select(".country-value").text(d => {
    if (d.current == null) return "";
    if (CONFIG.colorMode === "categorical") return labelByValue(d.current);
    return fmtVal(d.current);
  });

  const maxVal = CONFIG.colorMode === "categorical"
    ? ((CONFIG.categories?.length ?? 2) - 1)
    : (d3.max(rows, r => r.current) || 1);
  merged.each(function(d) {
    const pct = d.current == null || maxVal <= 0 ? 0 : (d.current / maxVal) * 100;
    this.style.setProperty("--bar-w", Math.min(100, pct) + "%");
  });
}


/* ── Projection ───────────────────────────────────────────────────────────── */
function makeProjection(width, height) {
  if (state.isZoomed && state.mapSelected.size) {
    const features = state.features.filter(f => state.mapSelected.has(entityForFeature(f)?.name));
    if (features.length) {
      const centroid = d3.geoCentroid({ type: "FeatureCollection", features });
      const proj = d3.geoOrthographic()
        .rotate([-centroid[0], -centroid[1]])
        .translate([width / 2, height / 2]);
      // fit to the actual selected features, then pull back to show globe border
      proj.fitExtent([[60, 40], [width - 60, height - 40]], { type: "FeatureCollection", features });
      proj.scale(proj.scale() * 0.65).translate([width / 2, height / 2]);
      return proj;
    }
  }
  if (state.region && state.region !== "world") {
    const bbox = REGION_BBOX[state.region];
    if (bbox) {
      const [[lon0, lat0], [lon1, lat1]] = bbox;
      return d3.geoNaturalEarth1().fitExtent(
        [[18, 12], [width - 18, height - 34]],
        { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[lon0,lat0],[lon1,lat0],[lon1,lat1],[lon0,lat1]] } }
      );
    }
  }
  return d3.geoNaturalEarth1()
    .fitExtent([[10, 12], [width - 10, height - 34]], { type: "Sphere" });
}

function zoomToSel() {
  if (!state.mapSelected.size) return;
  state.isZoomed = true;
  renderMap(); showMapControls();
}

function resetView() {
  state.isZoomed   = false;
  state.rangeActive = false;
  state.region     = "world";
  els.regionSelect.property("value", "world");
  els.mapPair.classed("range-mode", false);
  syncSliderHandles();
  renderMap(); showMapControls();
}

function showMapControls() {
  const showReset = state.rangeActive || state.isZoomed;
  els.zoomSelBtn.classed("hidden",  state.rangeActive || !state.mapSelected.size || state.isZoomed);
  els.resetViewBtn.classed("hidden", !showReset);
  els.regionSelect.classed("hidden", !state.rangeActive);
  // Only show controls div when on map view
  d3.select("#map-controls").classed("hidden", state.view !== "map");
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

  /* Globe sphere + graticule when using orthographic (zoomed) */
  if (state.isZoomed) {
    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "#f0f4f8")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5);

    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.4);
  }

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
      return `country${v == null ? " no-data" : ""}`;
    })
    .attr("d", path)
    .style("fill", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      const c   = v != null ? colorByValue(v) : null;
      return c || `url(#${hatchId})`;
    })
    .on("mouseenter", (event, d) => {
      const ent = entityForFeature(d);
      if (!ent) return;
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
      state.mapSelected.has(ent.name) ? state.mapSelected.delete(ent.name) : state.mapSelected.add(ent.name);
      renderAll();
    });

  /* Value labels — only for selected countries */
  const labelData = state.features
    .map(f => {
      const ent = entityForFeature(f);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      if (v == null || !state.mapSelected.has(ent?.name)) return null;
      const [cx, cy] = projection(d3.geoCentroid(f));
      if (!isFinite(cx) || !isFinite(cy)) return null;
      return { value: v, cx, cy };
    })
    .filter(Boolean);

  const isDark = v => v >= 30;   // threshold-based: dark fill → white text

  svg.append("g").attr("class", "map-value-labels").attr("pointer-events", "none")
    .selectAll("text")
    .data(labelData)
    .join("text")
    .attr("x", d => d.cx)
    .attr("y", d => d.cy)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .attr("fill", d => isDark(d.value) ? "#fff" : "#333")
    .attr("paint-order", "stroke")
    .attr("stroke", d => isDark(d.value) ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)")
    .attr("stroke-width", "2px")
    .text(d => fmtVal(d.value));
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
  svgs.forEach(svg => svg.selectAll(".country")
    .classed("hovered",  d => entityForFeature(d)?.name === state.hovered)
    .classed("selected", d => state.mapSelected.has(entityForFeature(d)?.name))
    .classed("dimmed",   d => !!state.hovered && entityForFeature(d)?.name !== state.hovered));
  d3.selectAll(".country-row")
    .classed("active", d => activeSelection().has(d.name) || state.hovered === d.name);
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

  if (CONFIG.colorMode === "threshold") {
    const labels = CONFIG.thresholdLabels || CONFIG.thresholds.map(String);
    const n      = CONFIG.colors.length;
    const cols   = `repeat(${n}, 1fr)`;
    const wrap   = els.legend.append("div");
    wrap.append("div").attr("class", "legend-labels")
      .style("grid-template-columns", cols)
      .selectAll("div").data(CONFIG.colors).join("div")
      .text((_, i) => labels[i] ?? "");
    wrap.append("div").attr("class", "legend-blocks")
      .style("grid-template-columns", cols)
      .selectAll("div").data(CONFIG.colors).join("div")
      .attr("class", "legend-cell").style("background", d => d).style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightBucket(d))
      .on("mouseleave", clearBucketHighlight);

  } else {
    const cats = CONFIG.categories || [];
    const n    = cats.length;
    const cols = `repeat(${n}, 150px)`;
    const wrap = els.legend.append("div");
    wrap.append("div").attr("class", "legend-labels")
      .style("grid-template-columns", cols)
      .selectAll("div").data(cats).join("div").text(d => d.label);
    wrap.append("div").attr("class", "legend-blocks")
      .style("grid-template-columns", cols)
      .selectAll("div").data(cats).join("div")
      .attr("class", "legend-cell").style("background", d => d.color).style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightBucket(d.value))
      .on("mouseleave", clearBucketHighlight);
  }
}

function highlightBucket(value) {
  const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
  svgs.forEach((svg, i) => {
    const yr = (state.rangeActive && i === 0) ? state.startYear : state.endYear;
    svg.classed("map-dimmed", true);
    svg.selectAll(".country").classed("bucket-highlight", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, yr) : null;
      if (value === "nodata") return v == null;
      if (CONFIG.colorMode === "threshold") return v != null && colorByValue(v) === value;
      return v === value;
    });
  });
}

function clearBucketHighlight() {
  [els.mapLeft, els.mapSvg].forEach(svg => {
    svg.classed("map-dimmed", false);
    svg.selectAll(".country").classed("bucket-highlight", false);
  });
}


/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function showTooltip(event, ent, year) {
  const v = valueAtYear(ent.values, year);
  const valText = v == null ? "No data"
    : CONFIG.colorMode === "categorical" ? labelByValue(v)
    : v.toLocaleString();
  els.tooltip.classed("hidden", false)
    .html(`<h3>${ent.name}</h3><div>${year}: <strong>${valText}</strong></div><svg></svg>`);
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
function isCountry(entityName) {
  return state.features.some(f => entityForFeature(f)?.name === entityName);
}

function renderTable() {
  const q     = els.tableSearch.property("value").trim().toLowerCase();
  const isCat = CONFIG.colorMode === "categorical";

  // counts for filter dropdown labels
  const allCount       = state.entities.length;
  const selCount       = state.selected.size;
  const countriesCount = state.entities.filter(e => isCountry(e.name)).length;
  const filterSel = document.getElementById("table-filter-select");
  if (filterSel) {
    filterSel.options[0].text = `All (${allCount})`;
    filterSel.options[1].text = `Selection (${selCount})`;
    filterSel.options[2].text = `Countries (${countriesCount})`;
  }

  const rows  = state.entities
    .filter(e => {
      if (state.tableFilter === "selection") return state.selected.has(e.name);
      if (state.tableFilter === "countries") return isCountry(e.name);
      return true;
    })
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .map(e => ({
      ...e,
      sv:     valueAtYear(e.values, state.startYear),
      ev:     valueAtYear(e.values, state.endYear),
      change: changeBetween(e.values, state.startYear, state.endYear),
    }))
    .sort((a, b) => d3.ascending(a.name, b.name));

  els.tableHead.html(`<tr>
    <th>Country or region</th>
    <th>${state.startYear}</th>
    <th>${state.endYear}</th>
    <th>${state.minYear}–${state.maxYear}</th>
    <th>Change</th>
    ${isCat ? "" : "<th>Relative change</th>"}
  </tr>`);

  const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("tr");
  enter.append("td").attr("class", "name-cell");
  enter.append("td").attr("class", "start-cell");
  enter.append("td").attr("class", "end-cell");
  enter.append("td").append("svg").attr("class", "sparkline");
  enter.append("td").attr("class", "abs-cell");
  if (!isCat) enter.append("td").attr("class", "rel-cell");

  const merged = join.merge(enter);
  merged.select(".name-cell").text(d => d.name);
  merged.select(".start-cell").text(d =>
    d.sv == null ? "" : isCat ? labelByValue(d.sv) : d.sv.toLocaleString());
  merged.select(".end-cell").text(d =>
    d.ev == null ? "" : isCat ? labelByValue(d.ev) : d.ev.toLocaleString());
  merged.select(".abs-cell").text(d =>
    d.change == null ? "" : `${d.change >= 0 ? "+" : ""}${isCat ? d.change : d.change.toLocaleString()}`);
  if (!isCat) {
    merged.select(".rel-cell").text(d =>
      d.sv ? d3.format("+.0%")((d.ev - d.sv) / Math.abs(d.sv)) : "");
  }
  merged.select("svg").each(function (d) {
    drawTinyLine(d3.select(this), d.values, 150, 42, false);
  });
}


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


function highlightLineEntity(svg, name) {
  svg.selectAll(".entity-line")
    .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
    .attr("stroke-width", function() { return this.getAttribute("data-entity") === name ? 2.5 : 1.5; });
  svg.selectAll(".entity-label")
    .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
    .attr("font-weight", function() { return this.getAttribute("data-entity") === name ? "700" : "400" ; });
}

function clearLineHighlight(svg) {
  svg.selectAll(".entity-line")
    .style("opacity", 1)
    .attr("stroke-width", 2);
  svg.selectAll(".entity-label")
    .style("opacity", 1)
    .attr("font-weight", "400");
}


/* ── Line chart ───────────────────────────────────────────────────────────── */
function renderLine() {
  const svg    = els.lineSvg;
  const node   = svg.node();
  const width  = node.clientWidth || 1000;
  const height = 520;
  const margin = { top: 24, right: 160, bottom: 44, left: 60 };

  svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();

  const selected = state.selected.size
    ? [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean)
    : state.entities.slice(0, 4);

  if (!selected.length) return;

  const entities = selected.map(e => ({
    ...e,
    inRange: e.values.filter(d => d.year >= state.startYear && d.year <= state.endYear && d.value != null),
  })).filter(e => e.inRange.length);

  if (!entities.length) return;

  /* scales */
  const x = d3.scaleLinear()
    .domain([state.startYear, state.endYear])
    .range([margin.left, width - margin.right]);

  const yMax = d3.max(entities.flatMap(e => e.inRange.map(d => d.value))) || 1;
  const y = d3.scaleLinear()
    .domain([0, yMax])
    .range([height - margin.bottom, margin.top])
    .nice();

  const colorOf = name => entityLineColor(name, entities);

  /* gridlines */
  const yTicks = y.ticks(6);
  svg.append("g").selectAll("line")
    .data(yTicks).join("line")
    .attr("x1", margin.left).attr("x2", width - margin.right)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", "#e5e5e5").attr("stroke-dasharray", "4,3");

  /* Y axis */
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .tickValues(yTicks)
        .tickFormat(d => d >= 1000 ? `${d / 1000}k` : String(d))
        .tickSize(0)
    )
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick text")
      .attr("x", -8).attr("font-size", 13).attr("fill", "#555"));

  /* X axis */
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .ticks(Math.min(12, state.endYear - state.startYear))
        .tickFormat(d3.format("d"))
        .tickSizeOuter(0)
    )
    .call(g => g.select(".domain").attr("stroke", "#ccc"))
    .call(g => g.selectAll(".tick line").attr("stroke", "#ccc"))
    .call(g => g.selectAll(".tick text")
      .attr("font-size", 13).attr("fill", "#555"));

  /* lines */
  const line = d3.line()
    .defined(d => d.value != null)
    .x(d => x(d.year))
    .y(d => y(d.value))
    .curve(d3.curveLinear);

  entities.forEach(e => {
    svg.append("path")
      .datum(e.inRange)
      .attr("class", "line-path entity-line")
      .attr("data-entity", e.name)
      .attr("stroke", colorOf(e.name))
      .attr("d", line)
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightLineEntity(svg, e.name))
      .on("mouseleave", () => clearLineHighlight(svg));
  });

  /* end-of-line labels with collision avoidance */
  const labelItems = entities
    .map(e => {
      const last = e.inRange.at(-1);
      return last ? { name: e.name, lx: x(last.year), ly: y(last.value) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.ly - b.ly);

  const MIN_GAP = 15;
  for (let i = 1; i < labelItems.length; i++) {
    if (labelItems[i].ly - labelItems[i - 1].ly < MIN_GAP)
      labelItems[i].ly = labelItems[i - 1].ly + MIN_GAP;
  }

  labelItems.forEach(d => {
    svg.append("text")
      .attr("class", "entity-label")
      .attr("data-entity", d.name)
      .attr("x", d.lx + 8)
      .attr("y", d.ly)
      .attr("dominant-baseline", "middle")
      .attr("font-size", 12)
      .attr("fill", colorOf(d.name))
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightLineEntity(svg, d.name))
      .on("mouseleave", () => clearLineHighlight(svg))
      .text(d.name);
  });

  /* hover: vertical rule + dots + tooltip */
  const vLine = svg.append("line")
    .attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#aaa").attr("stroke-width", 1).attr("stroke-dasharray", "4,2")
    .style("display", "none");

  const dots = svg.selectAll("circle.line-dot")
    .data(entities).join("circle")
    .attr("class", "line-dot")
    .attr("r", 4)
    .attr("stroke", "#fff").attr("stroke-width", 1.5)
    .attr("fill", e => colorOf(e.name))
    .style("display", "none");

  const tipEl   = d3.select("#tooltip");
  const tipName = tipEl.select("#tip-name");
  const tipVal  = tipEl.select("#tip-val");

  svg.append("rect")
    .attr("x", margin.left).attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "none").attr("pointer-events", "all")
    .on("mousemove", function(event) {
      const [mx, my] = d3.pointer(event);
      const yr = Math.round(x.invert(mx));
      const cx = x(yr);
      vLine.attr("x1", cx).attr("x2", cx).style("display", null);

      dots.style("display", null)
        .attr("cx", e => {
          const d = e.inRange.find(d => d.year === yr);
          return d ? x(d.year) : -999;
        })
        .attr("cy", e => {
          const d = e.inRange.find(d => d.year === yr);
          return d ? y(d.value) : -999;
        })
        .style("display", e => e.inRange.find(d => d.year === yr) ? null : "none");

      // Find entity whose line is nearest to mouse Y (for highlight)
      let nearestName = null, nearestDist = Infinity;
      entities.forEach(e => {
        const d = e.inRange.find(d => d.year === yr);
        if (d) {
          const dist = Math.abs(y(d.value) - my);
          if (dist < nearestDist) { nearestDist = dist; nearestName = e.name; }
        }
      });

      const rows = entities
        .map(e => {
          const d = e.inRange.find(d => d.year === yr);
          if (!d) return null;
          const near = e.name === nearestName;
          return `<div class="tip-row${near ? " tip-nearest" : ""}" style="--c:${colorOf(e.name)}">
            <span class="tip-dot"></span>
            <span class="tip-ename">${e.name}</span>
            <span class="tip-evalue">${fmtVal(d.value)}</span>
          </div>`;
        })
        .filter(Boolean).join("");

      if (!rows) return;

      tipName.text(yr);
      tipVal.html(rows);

      const lineViewRect = document.getElementById("line-view").getBoundingClientRect();
      let left = event.clientX - lineViewRect.left + 18;
      let top  = event.clientY - lineViewRect.top  - 20;
      if (left + 270 > lineViewRect.width) left = event.clientX - lineViewRect.left - 270;
      tipEl.classed("hidden", false).style("left", left + "px").style("top", top + "px");
    })
    .on("mouseleave", () => {
      vLine.style("display", "none");
      dots.style("display", "none");
      tipEl.classed("hidden", true);
    });
}

/* ── Bar chart view (single year = endYear) ──────────────────────────────── */
function renderBar() {
  const BAR_COLOR = "#6475a3";
  const svg    = d3.select("#bar-svg");
  const node   = svg.node();
  const width  = node.clientWidth || 900;
  const year   = state.endYear;

  const selected = state.selected.size
    ? [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean)
    : state.entities.slice(0, 10);

  const barData = selected
    .map(e => ({ name: e.name, value: valueAtYear(e.values, year) }))
    .filter(d => d.value != null)
    .sort((a, b) => d3.descending(a.value, b.value));

  if (!barData.length) { svg.selectAll("*").remove(); return; }

  const rowH   = 32;
  const margin = { top: 8, right: 220, bottom: 8, left: 160 };
  const iW     = width - margin.left - margin.right;
  const iH     = barData.length * rowH;
  const height = iH + margin.top + margin.bottom;

  svg.attr("viewBox", `0 0 ${width} ${height}`)
     .attr("width", "100%")
     .selectAll("*").remove();

  const x = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d.value) * 1.08])
    .range([0, iW]);

  const y = d3.scaleBand()
    .domain(barData.map(d => d.name))
    .range([0, iH])
    .padding(0.25);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  /* Y axis — entity names */
  g.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .call(ax => ax.select(".domain").remove())
    .selectAll("text")
      .attr("fill", "#444").attr("font-size", "13px").attr("x", -8);

  /* Bars */
  g.selectAll(".bar")
    .data(barData).join("rect")
    .attr("class", "bar")
    .attr("x", 0)
    .attr("y", d => y(d.name))
    .attr("height", y.bandwidth())
    .attr("width", d => Math.max(0, x(d.value)))
    .attr("fill", BAR_COLOR)
    .attr("rx", 2);

  /* Value labels */
  g.selectAll(".bar-label")
    .data(barData).join("text")
    .attr("class", "bar-label")
    .attr("x", d => x(d.value) + 5)
    .attr("y", d => y(d.name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("fill", "#555")
    .attr("font-size", "13px")
    .text(d => fmtVal(d.value));
}

/*  Slope */
function renderSlope() {
  const svg    = d3.select("#slope-svg");
  const node   = svg.node();
  if (!node) return;
  const width  = node.clientWidth || 1000;
  const height = 520;
  const margin = { top: 24, right: 220, bottom: 44, left: 50 };

  svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();

  const selected = state.selected.size
    ? [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean)
    : state.entities.slice(0, 5);

  if (!selected.length) return;

  const entities = selected.map(e => ({
    ...e,
    sv: valueAtYear(e.values, state.startYear),
    ev: valueAtYear(e.values, state.endYear),
  })).filter(e => e.sv != null || e.ev != null);

  if (!entities.length) return;

  const colorOf = name => entityLineColor(name, entities);

  /* x: two fixed positions for start/end year. The OWID original keeps the
     slope lines themselves narrow (~55% of the inner width) and reserves the
     rest on the right for "Name value" labels — it does not stretch the
     lines across the full chart width. */
  const innerW    = width - margin.left - margin.right;
  const slopeW    = innerW * 0.55;
  const xLeft     = margin.left + (innerW - slopeW) / 2; // center the slope itself
  const xRight    = xLeft + slopeW;

  /* y scale */
  const allVals = entities.flatMap(e => [e.sv, e.ev]).filter(v => v != null);
  const y = d3.scaleLinear()
    .domain([0, d3.max(allVals) || 1])
    .range([height - margin.bottom, margin.top])
    .nice();

  /* No full multi-tick axis in the original — just a single "0" baseline label */
  svg.append("text")
    .attr("x", margin.left).attr("y", y(0))
    .attr("text-anchor", "start").attr("dominant-baseline", "middle")
    .attr("font-size", 13).attr("fill", "#555")
    .text("0");

  /* year labels on x axis */
  svg.append("text")
    .attr("x", xLeft).attr("y", height - margin.bottom + 28)
    .attr("text-anchor", "middle").attr("font-size", 13).attr("fill", "#555")
    .text(state.startYear);
  svg.append("text")
    .attr("x", xRight).attr("y", height - margin.bottom + 28)
    .attr("text-anchor", "middle").attr("font-size", 13).attr("fill", "#555")
    .text(state.endYear);

  /* vertical reference lines at start and end year */
  [xLeft, xRight].forEach(x => {
    svg.append("line")
      .attr("x1", x).attr("x2", x)
      .attr("y1", margin.top).attr("y2", height - margin.bottom)
      .attr("stroke", "#ccc").attr("stroke-width", 1);
  });

  /* slope lines and dots */
  entities.forEach(e => {
    const color = colorOf(e.name);

    if (e.sv != null && e.ev != null) {
      svg.append("line")
        .attr("x1", xLeft).attr("y1", y(e.sv))
        .attr("x2", xRight).attr("y2", y(e.ev))
        .attr("stroke", color).attr("stroke-width", 2)
        .attr("class", "slope-line slope-entity")
        .attr("data-entity", e.name)
        .style("cursor", "pointer")
        .on("mouseenter", () => highlightSlopeEntity(svg, e.name))
        .on("mouseleave", () => clearSlopeHighlight(svg));
    }

    /* dot at startYear */
    if (e.sv != null) {
      svg.append("circle")
        .attr("cx", xLeft).attr("cy", y(e.sv))
        .attr("r", 4).attr("fill", color)
        .attr("stroke", "#fff").attr("stroke-width", 1.5);
    }
    /* dot at endYear */
    if (e.ev != null) {
      svg.append("circle")
        .attr("cx", xRight).attr("cy", y(e.ev))
        .attr("r", 4).attr("fill", color)
        .attr("stroke", "#fff").attr("stroke-width", 1.5);
    }
  });

  /* left labels (startYear values) with collision avoidance. When a label gets
     pushed away from its dot's actual y-position, draw a short leader line
     bridging the gap so it's still clear which value the label belongs to. */
  const leftItems = entities
    .filter(e => e.sv != null)
    .map(e => ({ name: e.name, ly: y(e.sv), origLy: y(e.sv), v: e.sv }))
    .sort((a, b) => a.ly - b.ly);

  avoidCollisions(leftItems);

  svg.selectAll(".left-leader")
    .data(leftItems.filter(d => Math.abs(d.ly - d.origLy) > 0.5))
    .join("path")
    .attr("class", "slope-leader")
    .attr("d", d => `M${xLeft},${d.origLy} L${xLeft - 4},${d.origLy} L${xLeft - 8},${d.ly}`)
    .attr("fill", "none")
    .attr("stroke", d => colorOf(d.name))
    .attr("stroke-width", 1).style("opacity", 0.6);

  leftItems.forEach(d => {
    svg.append("text")
      .attr("x", xLeft - 8).attr("y", d.ly)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("font-size", 12).attr("fill", colorOf(d.name))
      .attr("class", "slope-label slope-entity")
      .attr("data-entity", d.name)
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightSlopeEntity(svg, d.name))
      .on("mouseleave", () => clearSlopeHighlight(svg))
      .text(fmtVal(d.v));
  });

  /* right labels (entity name + endYear value) with collision avoidance,
     same leader-line treatment when pushed away from their dot */
  const rightItems = entities
    .filter(e => e.ev != null)
    .map(e => ({ name: e.name, ly: y(e.ev), origLy: y(e.ev), v: e.ev }))
    .sort((a, b) => a.ly - b.ly);

  avoidCollisions(rightItems);

  svg.selectAll(".right-leader")
    .data(rightItems.filter(d => Math.abs(d.ly - d.origLy) > 0.5))
    .join("path")
    .attr("class", "slope-leader")
    .attr("d", d => `M${xRight},${d.origLy} L${xRight + 4},${d.origLy} L${xRight + 8},${d.ly}`)
    .attr("fill", "none")
    .attr("stroke", d => colorOf(d.name))
    .attr("stroke-width", 1).style("opacity", 0.6);

  rightItems.forEach(d => {
    svg.append("text")
      .attr("x", xRight + 8).attr("y", d.ly)
      .attr("text-anchor", "start").attr("dominant-baseline", "middle")
      .attr("font-size", 12).attr("fill", colorOf(d.name))
      .attr("class", "slope-label slope-entity")
      .attr("data-entity", d.name)
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightSlopeEntity(svg, d.name))
      .on("mouseleave", () => clearSlopeHighlight(svg))
      .text(`${d.name} ${fmtVal(d.v)}`);
  });
}

function avoidCollisions(items) {
  const MIN_GAP = 14;
  // push down pass
  for (let i = 1; i < items.length; i++) {
    if (items[i].ly - items[i - 1].ly < MIN_GAP)
      items[i].ly = items[i - 1].ly + MIN_GAP;
  }
  // push up pass
  for (let i = items.length - 2; i >= 0; i--) {
    if (items[i + 1].ly - items[i].ly < MIN_GAP)
      items[i].ly = items[i + 1].ly - MIN_GAP;
  }

}
function highlightSlopeEntity(svg, name) {
  svg.selectAll(".slope-entity")
    .style("opacity", function() {
      return this.getAttribute("data-entity") === name ? 1 : 0.25;
    });
  svg.selectAll(".slope-line")
    .attr("stroke-width", function() {
      return this.getAttribute("data-entity") === name ? 3 : 1.5;
    });
}

function clearSlopeHighlight(svg) {
  svg.selectAll(".slope-entity").style("opacity", 1);
  svg.selectAll(".slope-line").attr("stroke-width", 2);
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

/* ── Marimekko view ───────────────────────────────────────────────────────── */
function renderMekko() {
  const svgNode = document.getElementById("mekko-svg");
  if (!svgNode) return;
  const svg    = d3.select(svgNode);
  const width  = svgNode.clientWidth || 900;
  const year   = state.endYear;

  const legendH = 28;
  const chartH  = 380; // fixed plot height for the bars themselves
  // Reserve enough room below the axis for the deepest possible staggered label
  // row (capped at MAX_LABEL_DEPTH) plus a long rotated name, so labels never
  // overflow past the SVG into the page below.
  const MAX_LABEL_DEPTH = 5;
  const labelGap  = 34;
  const depthStep = 34;
  const margin  = {
    top: legendH + 16, right: 20, left: 50,
    bottom: labelGap + MAX_LABEL_DEPTH * depthStep + 170,
  };
  const height  = margin.top + chartH + margin.bottom;
  const iW = width  - margin.left - margin.right;
  const iH = chartH;

  svg.attr("viewBox", `0 0 ${width} ${height}`)
     .attr("width", "100%")
     .selectAll("*").remove();

  const data = state.entities
    .filter(e => isCountry(e.name))
    .map(e => {
      const ent = state.entityMap.get(e.name);
      return {
        name:      e.name,
        value:     valueAtYear(e.values, year),
        continent: continentOf(ent),
      };
    })
    .filter(d => d.value != null)
    .sort((a, b) => d3.descending(a.value, b.value));  // high → low, left → right

  if (!data.length) {
    svg.append("text").attr("x", margin.left).attr("y", 60)
       .attr("fill", "#666").text("No data for this year");
    return;
  }

  const n    = data.length;
  const barW = iW / n;

  const barColor = d => CONTINENT_COLORS[d.continent] || "#aaa";

  /* ── Region legend — continents with a selected country are bolded/full color;
     the rest are dimmed (only when there is an active selection) ── */
  const activeContinents = new Set(
    [...state.mekkoSelected].map(name => continentOf(state.entityMap.get(name))).filter(Boolean)
  );
  const legendG = svg.append("g").attr("class", "label-country").attr("transform", `translate(${margin.left},8)`);
  const legendItemW = iW / CONTINENT_ORDER.length;
  CONTINENT_ORDER.forEach((cont, i) => {
    const isActive = !state.mekkoSelected.size || activeContinents.has(cont);
    const lg = legendG.append("g").attr("transform", `translate(${i * legendItemW},0)`);
    lg.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2)
      .attr("fill", CONTINENT_COLORS[cont])
      .style("opacity", isActive ? 1 : 0.35);
    lg.append("text")
      .attr("x", 17).attr("y", 10)
      .attr("font-size", 10)
      .attr("font-weight", isActive ? 700 : 400)
      .attr("fill", isActive ? "#222" : "#aaa")
      .text(cont);
    lg.style("cursor", "pointer")
      .on("mouseenter", () => {
        d3.select(svgNode).selectAll(".mekko-bar")
        .style("opacity", dd=>dd.continent == cont ? 1: 0.3);
      })
      .on("mouseleave", () => {
        d3.select(svgNode).selectAll(".mekko-bar")
          .style("opacity", dd => hasSelection && !mekkoSel.has(dd.name) ? 0.3 : 1);
      });
  });

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const y = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  /* gridlines */
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  g.append("g").selectAll("line")
    .data(yTicks).join("line")
    .attr("x1", 0).attr("x2", iW)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", d => d === 0 ? "#bbb" : "#e5e5e5");

  /* Y axis */
  g.append("g")
    .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format(".1f")).tickSize(0))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick text").attr("x", -8).attr("font-size", 12).attr("fill", "#555"));

  const mekkoSel    = state.mekkoSelected;
  const hasSelection = mekkoSel.size > 0;
  const mekkoTip     = d3.select("#mekko-tooltip");

  /* bars */
  g.selectAll(".mekko-bar")
    .data(data).join("rect")
    .attr("class", "mekko-bar")
    .attr("x", (_, i) => i * barW)
    .attr("y", d => y(d.value))
    .attr("width", Math.max(1, barW - 0.5))
    .attr("height", d => iH - y(d.value))
    .attr("fill",   barColor)
    .attr("stroke", d => mekkoSel.has(d.name) ? barColor(d) : "none")
    .attr("stroke-width", 0.75)
    .style("opacity", d => {
      if (hasSelection) return mekkoSel.has(d.name) ? 1 : 0.3;
      return state.hovered && state.hovered !== d.name ? 0.4 : 1;
    })
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      state.hovered = d.name;
      mekkoTip.classed("hidden", false).html(
        `<h3>${d.name}</h3>
         <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
         <div>${year}: <strong>${d.value.toFixed(3)}</strong></div>`
      );
      moveMekkoTooltip(event);
      renderCountryList();
    })
    .on("mousemove", event => moveMekkoTooltip(event))
    .on("mouseleave", () => {
      state.hovered = null;
      mekkoTip.classed("hidden", true);
      renderCountryList();
    })
    .on("click", (_, d) => {
      mekkoSel.has(d.name) ? mekkoSel.delete(d.name) : mekkoSel.add(d.name);
      renderAll();
    });

  /* X-axis labels: sample ~18 evenly spaced indices, but EVERY selected country is
     always included (never dropped for crowding). Sampled slots too close to a
     selected one are dropped instead, since the selected label always wins. */
  const step = Math.max(1, Math.round(n / 18));
  const sampleIdx = new Set();
  for (let i = 0; i < n; i += step) sampleIdx.add(i);

  const selIdx = new Set();
  mekkoSel.forEach(name => {
    const idx = data.findIndex(d => d.name === name);
    if (idx !== -1) selIdx.add(idx);
  });
  [...sampleIdx].forEach(si => {
    for (const idx of selIdx) {
      if (Math.abs(si - idx) < step / 2) { sampleIdx.delete(si); break; }
    }
  });
  selIdx.forEach(idx => sampleIdx.add(idx));

  let labelData = [...sampleIdx].sort((a, b) => a - b)
    .map(i => ({ ...data[i], i, naturalX: i * barW + barW / 2, selected: selIdx.has(i) }));

  /* Horizontal collision avoidance: push label anchors apart left→right so none
     overlap (e.g. two adjacent selected bars). A selected label is never dropped —
     it just gets nudged sideways, with an elbow leader line bridging the gap back
     to its actual bar. Required gap is estimated per-label from its text length,
     since longer rotated names need more horizontal clearance than short ones. */
  const MIN_LABEL_GAP = 15;
  const CHAR_W = 10.5; // approx px per character, bold font-size 13, rotated -45
  labelData.forEach(d => {
    d.labelX  = d.naturalX;
    d.gapNeed = Math.max(MIN_LABEL_GAP, d.name.length * CHAR_W * Math.SQRT1_2);
    d.depth = 0;
  });
  
  if (mekkoSel.size > 0) {
    // nudge - creating an elbow
    for (let k = 1; k < labelData.length; k++) {
      const need = Math.max(labelData[k - 1].gapNeed, labelData[k].gapNeed);
      if (labelData[k].labelX - labelData[k - 1].labelX < need) {
        labelData[k].labelX = labelData[k - 1].labelX + need;
      }
    }
  } else {
    /* Depth staggering: when several bars sit close together (their *actual* x
     positions, not the nudged label positions), step the depth up by one for each
     consecutive close label (0, 1, 2, 3…) instead of just toggling between two
     levels — three or more clustered labels each need their own distinct row,
     not just alternating ones. Depth resets once there's enough clearance again,
     and is capped so labels can never overflow past the reserved bottom margin —
     beyond the cap, extra crowded labels just re-share the deepest row. */
    // let lastLabelX = -Infinity, depth = 0;
    // labelData.forEach(d => {
    //   depth = (d.labelX - lastLabelX < d.gapNeed) ? depth + 1 : 0;
    //   d.depth = Math.min(depth, MAX_LABEL_DEPTH);
    //   lastLabelX = d.labelX;
    // });
    for (let k = labelData.length - 1; k >= 0; k--) {
    if (labelData[k].labelX > iW) {
      labelData[k].labelX = iW;
      for (let j = k - 1; j >= 0; j--) {
        const need = Math.max(labelData[j].gapNeed, labelData[j + 1].gapNeed);
        if (labelData[j].labelX > labelData[j + 1].labelX - need) {
          labelData[j].labelX = labelData[j + 1].labelX - need;
        } else break;
      }
    }
  }
  }

  /* leader line: elbow path — down from the bar, sideways to the (possibly nudged)
     label position, then down again to where the rotated label starts */
  const elbowY = iH + 8;
  g.append("g").attr("class", "mekko-label-lines")
    .selectAll("path")
    .data(labelData).join("path")
    // .attr("d", d => `M${d.naturalX},${iH} L${d.naturalX},${elbowY} L${d.labelX},${elbowY} L${d.labelX},${iH + labelGap + d.depth * depthStep}`)
    .attr("d", d => {
        const textY = iH + labelGap + d.depth * depthStep;
        if (d.naturalX === d.labelX) {
          // straight line
          return `M${d.naturalX},${iH} L${d.labelX},${textY}`;
        }
        // with nudge -> elbow
        const elbowY = textY - 6;
        return `M${d.naturalX},${iH} L${d.naturalX},${elbowY} L${d.labelX},${elbowY} L${d.labelX},${textY}`;
      })
    .attr("fill", "none")
    .attr("stroke", "#aaa")
    .attr("stroke-width", 1);

  g.append("g").attr("class", "mekko-labels")
    .selectAll("text")
    .data(labelData).join("text")
    .attr("transform", d => `translate(${d.labelX},${iH + labelGap + d.depth * depthStep}) rotate(-45)`)
    .attr("text-anchor", "end")
    .attr("dx", "-5px")
    .attr("dy", ".32em")
    .attr("font-size", 13)
    .attr("font-weight", 700)
    .attr("fill", barColor)
    .style("cursor", "pointer")
    .text(d => d.name)
    .on("mouseenter", (event, d) => {
      state.hovered = d.name;
      mekkoTip.classed("hidden", false).html(
        `<h3>${d.name}</h3>
         <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
         <div>${year}: <strong>${d.value.toFixed(3)}</strong></div>`
      );
      moveMekkoTooltip(event);
      renderCountryList();
    })
    .on("mousemove", event => moveMekkoTooltip(event))
    .on("mouseleave", () => {
      state.hovered = null;
      mekkoTip.classed("hidden", true);
      renderCountryList();
    })
    .on("click", (_, d) => {
      mekkoSel.has(d.name) ? mekkoSel.delete(d.name) : mekkoSel.add(d.name);
      renderAll();
    });
}


function moveMekkoTooltip(event) {
  const rect = document.getElementById("mekko-view").getBoundingClientRect();
  d3.select("#mekko-tooltip")
    .style("left", `${event.clientX - rect.left + 16}px`)
    .style("top",  `${event.clientY - rect.top  - 40}px`);
}


function drawTinyLine(svg, values, width, height, axes, markerYear) {
  svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();
  const m = axes ? { top: 10, right: 10, bottom: 24, left: 28 } : { top: 5, right: 5, bottom: 5, left: 5 };

  // Table sparklines show full data range; tooltip sparklines show slider range
  const xMin = axes ? state.startYear : state.minYear;
  const xMax = axes ? state.endYear   : state.maxYear;

  const filtered = values.filter(d => d.year >= xMin && d.year <= xMax && d.value != null);
  const allValid  = values.filter(d => d.value != null);
  const x = d3.scaleLinear().domain([xMin, xMax]).range([m.left, width - m.right]);
  const [yMin, yMax] = yDomain(allValid);
  const y = d3.scaleLinear().domain([yMin, yMax]).range([height - m.bottom, m.top]);

  if (axes) {
    svg.append("g").attr("transform", `translate(0,${height - m.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));
    svg.append("g").attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4));
  }

  // Tooltip sparkline (axes=true): color each segment by value.
  // Table sparkline (axes=false): single original color.
  if (CONFIG.colorMode === "threshold" && axes) {
    const pairs = d3.pairs(filtered.filter(d => d.value != null));
    svg.append("g")
      .selectAll("line")
      .data(pairs)
      .join("line")
        .attr("x1", ([a]) => x(a.year)).attr("y1", ([a]) => y(a.value))
        .attr("x2", ([, b]) => x(b.year)).attr("y2", ([, b]) => y(b.value))
        .attr("stroke", ([a, b]) => colorByValue((a.value + b.value) / 2) || "#888")
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");
  } else {
    const line = d3.line().defined(d => d.value != null).curve(lineCurve)
      .x(d => x(d.year)).y(d => y(d.value));
    svg.append("path").datum(filtered)
      .attr("d", line).attr("fill", "none")
      .attr("stroke", "var(--axis-blue)").attr("stroke-width", axes ? 2.5 : 2);
  }

  if (axes) {
    // Map tooltip: marker dot colored by value
    const yr  = markerYear ?? state.endYear;
    const dot = filtered.find(d => d.year === yr) || filtered.at(-1);
    if (dot) {
      svg.append("circle")
        .attr("cx", x(dot.year)).attr("cy", y(dot.value))
        .attr("r", 4).attr("fill", colorByValue(dot.value) || "var(--axis-blue)");
    }
  } else {
    // Table sparkline: dots at startYear and endYear in original color
    [state.startYear, state.endYear].forEach(yr => {
      const dot = filtered.find(d => d.year === yr);
      if (dot) {
        svg.append("circle")
          .attr("cx", x(dot.year)).attr("cy", y(dot.value))
          .attr("r", 3).attr("fill", "var(--axis-blue)");
      }
    });
  }
}


/* ── HTML Slider ───────────────────────────────────────────────────────────── */
function pctToYear(pct) {
  return Math.round(state.minYear + (pct / 100) * (state.maxYear - state.minYear));
}

function makeDraggable(track, handleId, isStart) {
  const handle = document.getElementById(handleId);
  if (!handle) return;
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = ev => {
      const rect = track.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(100, (ev.clientX - rect.left) / rect.width * 100));
      const yr   = pctToYear(pct);
      if (isStart) state.startYear = Math.min(yr, state.endYear - 1);
      else {
        const isSingleYear = state.view === "mekko";
        state.endYear = isSingleYear
          ? Math.min(state.maxYear, Math.max(state.minYear, yr))
          : Math.max(yr, state.startYear + 1);
      }
      syncSliderHandles();
      renderAll();
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });
}

function initSlider() {
  const track = document.getElementById("slider-track");
  if (!track || !state.minYear) return;

  makeDraggable(track, "handle-start", true);
  makeDraggable(track, "handle-end",   false);

  /* fill bar drag: shift both handles while preserving span */
  const fill = document.getElementById("slider-fill");
  if (fill) {
    fill.addEventListener("mousedown", e => {
      e.preventDefault();
      e.stopPropagation();
      const span    = state.endYear - state.startYear;
      const startX  = e.clientX;
      const startSY = state.startYear;
      const onMove  = ev => {
        const rect    = track.getBoundingClientRect();
        const deltaPct = (ev.clientX - startX) / rect.width * 100;
        const deltaYr  = Math.round(deltaPct * (state.maxYear - state.minYear) / 100);
        let ns = startSY + deltaYr;
        ns = Math.max(state.minYear, Math.min(state.maxYear - span, ns));
        state.startYear = ns;
        state.endYear   = ns + span;
        syncSliderHandles();
        renderAll();
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup",   onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
  }

  /* Ghost handle: show on track hover when map view active */
  const ghost = document.getElementById("handle-ghost");
  track.addEventListener("mousemove", e => {
    const isSingleYear = state.view === "mekko";
    const isGhostView  = state.view === "map" || isSingleYear;
    if (!isGhostView || state.rangeActive) { ghost.classList.add("hidden"); return; }
    // if (state.view !== "map" || state.rangeActive) { ghost.classList.add("hidden"); return; }
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    const yr   = pctToYear(pct);
    if (!isSingleYear && yr >= state.endYear) { ghost.classList.add("hidden"); return; }
    ghost.classList.remove("hidden");
    ghost.style.left = pct + "%";
  });
  track.addEventListener("mouseleave", () => {
    if (!state.rangeActive) ghost.classList.add("hidden");
  });
  
  /* Ghost handle click: activate compare mode */
  ghost.addEventListener("click", e => {
    e.stopPropagation();
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (ghost.getBoundingClientRect().left + 8 - rect.left) / rect.width * 100));
    
    if ( state.view === "mekko") {
      // 단일 연도 이동 — range 모드 진입 없이 endYear만 변경
      state.endYear = Math.min(state.maxYear, Math.max(state.minYear, pctToYear(pct)));
      ghost.classList.add("hidden");
      syncSliderHandles();
      renderAll();
    } else {
      state.startYear   = Math.min(pctToYear(pct), state.endYear - 1);
      state.rangeActive = true;
      ghost.classList.add("hidden");
      els.mapPair.classed("range-mode", true);
      syncSliderHandles();
      renderAll();
      showMapControls();
    }

  });

  track.addEventListener("click", e => {
    if (e.target.classList.contains("slider-handle")) return;
    if (e.target.id === "slider-fill") return;
    if (e.target.id === "handle-ghost") return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    if(state.view === "mekko"){
      state.endYear = Math.min(state.maxYear, Math.max(state.minYear, pctToYear(pct)));

    } else if (state.rangeActive) {
      /* In compare mode: clicking left side moves startYear, right moves endYear */
      const yr = pctToYear(pct);
      if (yr < state.endYear) state.startYear = yr;
      else state.endYear = yr;
    } else {
      state.endYear = Math.max(state.startYear + 1, Math.min(state.maxYear, pctToYear(pct)));
    }
    syncSliderHandles();
    renderAll();
  });

  syncSliderHandles();
}

function syncSliderHandles() {
  if (!state.minYear) return;
  const range  = state.maxYear - state.minYear;
  const sp     = (state.startYear - state.minYear) / range * 100;
  const ep     = (state.endYear   - state.minYear) / range * 100;
  const fill   = document.getElementById("slider-fill");
  const hStart = document.getElementById("handle-start");
  const hEnd   = document.getElementById("handle-end");

  // Map tab without compare mode: single handle (hide start)
  // Table, Line, Bar + map compare mode: two handles
  const showStart = state.rangeActive || (state.view !== "map" && state.view !== "mekko");

  if (showStart) {
    if (fill) { fill.style.display = ""; fill.style.left = sp + "%"; fill.style.width = (ep - sp) + "%"; }
    // if (fill)   { fill.style.left = sp + "%"; fill.style.width = (ep - sp) + "%"; }
    if (hStart) { hStart.style.left = sp + "%"; hStart.classList.remove("hidden"); }
    els.startLabel.text(state.startYear);
  } else {
    if (fill) { fill.style.left = "0%"; fill.style.width = ep + "%"; fill.style.display = "none"; }
    // if (fill)   { fill.style.left = "0%"; fill.style.width = ep + "%"; }
    if (hStart) hStart.classList.add("hidden");
    els.startLabel.text(state.minYear);
  }

  if (hEnd) hEnd.style.left = ep + "%";
  els.endLabel.text(state.endYear);
}


/* ── Playback ─────────────────────────────────────────────────────────────── */
function togglePlay() {
  state.playing = !state.playing;
  els.play.text(state.playing ? "❚❚" : "▶");
  if (!state.playing) return;
  const timer = d3.interval(() => {
    if (!state.playing) return timer.stop();
    if (state.endYear >= state.maxYear) {
      timer.stop(); state.playing = false; els.play.text("▶");
    } else {
      state.endYear += 1;
    }
    renderAll();
  }, 500);
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
