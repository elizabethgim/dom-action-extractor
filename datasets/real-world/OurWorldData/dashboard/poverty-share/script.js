/*
  Share of population living in extreme poverty ($3/day) — OWID-style D3 dashboard
  Data: World Bank Poverty and Inequality Platform via OurWorldInData poverty explorer
*/
import * as d3 from "d3";
import * as topojson from "topojson-client";

// Works both bundled (Vite copies the asset and rewrites this to a hashed
// URL) and as a plain <script type="module"> in a browser (import.meta.url
// resolves to this file's own URL, so the relative path still works) —
// unlike `import "./styles.css"`, which only Vite understands.
const STYLE_URL = new URL("./styles.css", import.meta.url);

const CONFIG = {
  csvUrl:   "https://ourworldindata.org/explorers/poverty-explorer.csv?v=1&csvType=full&useColumnShortNames=false&Indicator=Share+in+poverty&Poverty+line=%243+per+day%3A+International+Poverty+Line&Household+survey+data+type=Show+data+from+both+income+and+consumption+surveys&Show+breaks+between+less+comparable+surveys=false",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title:    "Share of population living in extreme poverty",
  subtitle: "Share of population living below $3 a day (the International Poverty Line), measured in 2021 purchasing power parity (PPP) prices.",
  source:   "World Bank Poverty and Inequality Platform (2025); OurWorldInData.org/poverty | CC BY",

  // this explorer export has no ISO country-code column — map matching falls
  // back to country-name lookup (see entityForFeature)
  columns: { entity: "Country", code: null, year: "Year", value: "Share below $3 a day" },

  thresholds:      [1, 2, 5, 10, 20, 40, 60],
  thresholdLabels: ["<1%", "1%", "2%", "5%", "10%", "20%", "40%", "60%+"],
  colors: ["#ffffd4","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],

  initialSelected: ["World", "Nigeria", "Bangladesh", "Brazil"],
  mapHeight: 560,
};
/* ─────────────────────────────────────────────────────────────────────────── */

const MARKUP = `
  <main class="owid-card" id="app">
    <section class="chart-panel">
      <header class="chart-header">
        <div>
          <h1 id="title"><span id="title-text"></span><span id="title-year"></span></h1>
          <p class="subtitle" id="subtitle"></p>
        </div>
      </header>

      <nav class="tabs" aria-label="Visualization tabs">
        <button class="tab" data-view="table">▦ Table</button>
        <button class="tab active" data-view="map">🌐 Map</button>
        <button class="tab" data-view="line">⌁ Line</button>
        <button class="tab" data-view="bar">▮ Bar</button>
      </nav>

      <section class="visual-wrap">
        <div id="map-view" class="view active">
          <div class="map-toolbar">
            <button id="compare-btn" class="small-button">⇄ Compare years</button>
            <button id="zoom-sel-btn" class="small-button hidden">⊙ Zoom to selection</button>
            <button id="reset-zoom-btn" class="small-button hidden">↺ Reset zoom</button>
            <select id="region-select" class="region-select">
              <option value="world">World</option>
              <option value="africa">Africa</option>
              <option value="americas">Americas</option>
              <option value="asia">Asia</option>
              <option value="europe">Europe</option>
              <option value="oceania">Oceania</option>
            </select>
          </div>
          <div id="map-pair">
            <svg id="map-left" role="img"></svg>
            <svg id="map-svg" role="img"></svg>
          </div>
          <div id="map-tooltip" class="tooltip hidden"></div>
          <div id="legend" class="legend"></div>
        </div>

        <div id="table-view" class="view">
          <div class="table-tools">
            <strong id="table-title">Data</strong>
            <input id="table-search" type="search" placeholder="Search for a country or region" />
          </div>
          <div class="data-table-wrap">
            <table id="data-table">
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div id="line-view" class="view">
          <svg id="line-svg" role="img"></svg>
        </div>

        <div id="bar-view" class="view">
          <svg id="bar-svg" role="img"></svg>
        </div>
      </section>

      <section class="year-control" aria-label="Year range filter">
        <button id="play-button" class="play" aria-label="Play animation">▶</button>
        <span id="start-label" class="year-label"></span>
        <div class="slider-wrap">
          <svg id="slider-svg"></svg>
          <input id="start-input" type="number" class="yr-input" style="display:none" />
          <input id="end-input" type="number" class="yr-input" style="display:none" />
        </div>
        <span id="end-label" class="year-label"></span>
      </section>

      <footer class="chart-footer">
        <p><strong>Data source:</strong> <span id="source-text"></span></p>
      </footer>
    </section>

    <aside class="side-panel">
      <h2 id="side-title">ADD/REMOVE COUNTRIES AND REGIONS</h2>
      <input id="country-search" type="search" placeholder="Search for a country or region" />
      <button class="sort-button">↕ Sort by value, <span id="sort-year"></span></button>
      <div id="selection-section" class="hidden">
        <div class="selection-title">
          <span id="selection-count"></span>
          <button id="clear-selection">Clear</button>
        </div>
        <div id="selected-list"></div>
      </div>
      <div class="all-countries-label">All countries</div>
      <div id="country-list" class="country-list"></div>
    </aside>
  </main>
`;

export async function index(host) {
  const doc = host.ownerDocument;
  if (!doc.querySelector(`link[href="${STYLE_URL}"]`)) {
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_URL;
    doc.head.appendChild(link);
  }

  host.classList.add("poverty-share-chart-host");
  host.innerHTML = MARKUP;
  const root = d3.select(host);

  /* ── Value formatter ────────────────────────────────────────────────────── */
  function fmtVal(v) {
    if (v == null) return "";
    return v.toFixed(1) + "%";
  }

  /* ── Region bboxes for zoom ─────────────────────────────────────────────── */
  const REGION_BBOX = {
    africa:   [[-20, -38], [55,  38]],
    americas: [[-170,-58], [-30, 75]],
    asia:     [[ 25, -12], [150, 75]],
    europe:   [[-28,  35], [50,  72]],
    oceania:  [[ 90, -50], [180, 25]],
  };

  /* ── Color helpers ──────────────────────────────────────────────────────── */
  const colorScale = d3.scaleThreshold().domain(CONFIG.thresholds).range(CONFIG.colors);
  function colorByValue(v) { return v == null ? null : colorScale(v); }
  function labelByValue(v) { return v == null ? "No data" : fmtVal(v); }
  function yDomain(values) { return [0, d3.max(values, d => d.value) || 1]; }
  const lineCurve = d3.curveLinear;

  /* ── Line colors (per-entity palette) ───────────────────────────────────── */
  const LINE_COLORS = [
    "#b13507", "#c05917", "#286fa8", "#6d3e91", "#996d39",
    "#2d8168", "#8c4569", "#3b8558", "#be5915", "#283a68",
  ];
  function entityLineColor(name, entities) {
    const idx = entities.findIndex(e => e.name === name);
    return LINE_COLORS[idx >= 0 ? idx % LINE_COLORS.length : 0];
  }

  /* ── App state ───────────────────────────────────────────────────────────── */
  const state = {
    view: "map",
    minYear: null, maxYear: null, startYear: null, endYear: null,
    selected: new Set(), hovered: null, playing: false,
    rows: [], entities: [], entityMap: new Map(),
    byCode: new Map(), byCountryName: new Map(),
    world: null, features: [], centroids: new Map(),
    rangeActive: false, isZoomed: false, region: "world",
  };

  /* ── DOM references ─────────────────────────────────────────────────────── */
  const els = {
    titleText:        root.select("#title-text"),
    titleYear:        root.select("#title-year"),
    subtitle:         root.select("#subtitle"),
    tabs:             root.selectAll(".tab"),
    views:            root.selectAll(".view"),
    mapSvg:           root.select("#map-svg"),
    mapLeft:          root.select("#map-left"),
    mapPair:          root.select("#map-pair"),
    lineSvg:          root.select("#line-svg"),
    tooltip:          root.select("#map-tooltip"),
    countryList:      root.select("#country-list"),
    selectedList:     root.select("#selected-list"),
    selectionSection: root.select("#selection-section"),
    countrySearch:    root.select("#country-search"),
    tableSearch:      root.select("#table-search"),
    startLabel:       root.select("#start-label"),
    endLabel:         root.select("#end-label"),
    sortYear:         root.select("#sort-year"),
    selectionCount:   root.select("#selection-count"),
    clearSelection:   root.select("#clear-selection"),
    play:             root.select("#play-button"),
    legend:           root.select("#legend"),
    tableHead:        root.select("#data-table thead"),
    tableBody:        root.select("#data-table tbody"),
    sideTitle:        root.select("#side-title"),
    compareBtn:       root.select("#compare-btn"),
    zoomSelBtn:       root.select("#zoom-sel-btn"),
    resetZoomBtn:     root.select("#reset-zoom-btn"),
    regionSelect:     root.select("#region-select"),
  };

  /* ── SVG slider state ───────────────────────────────────────────────────── */
  let sliderXScale = null, sliderW = 0;
  const sliderR = 7, sliderTy = 14;
  let sliderHoverG, sliderTipCircle, sliderTipBg, sliderTipTxt;

  /* ── Data parsing ────────────────────────────────────────────────────────── */
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
      return { name, code, values };
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
  function bindControls() {
    els.tabs.on("click", function () {
      state.view = this.dataset.view;
      els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
      els.views.classed("active", function () { return this.id === `${state.view}-view`; });
      els.sideTitle.text(state.view === "table" ? "SELECT COUNTRIES" : "ADD/REMOVE COUNTRIES AND REGIONS");
      renderAll();
    });

    els.countrySearch.on("input", renderCountryList);
    els.tableSearch.on("input",   renderTable);
    els.clearSelection.on("click", () => { state.selected.clear(); renderAll(); });
    els.play.on("click", togglePlay);

    const onResize = debounce(() => {
      if (!host.isConnected) { window.removeEventListener("resize", onResize); return; }
      renderAll(); buildSlider();
    }, 120);
    window.addEventListener("resize", onResize);

    const startEl = host.querySelector("#start-input");
    const endEl   = host.querySelector("#end-input");
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

  /* ── Render orchestration ───────────────────────────────────────────────── */
  function renderAll() {
    const yearTxt = (state.view === "map" || state.view === "bar") ? `, ${state.endYear}` : "";
    els.titleYear.text(yearTxt);
    els.sortYear.text(state.endYear);
    els.selectionSection.classed("hidden", !state.selected.size);
    els.selectionCount.text(`Selection (${state.selected.size})`);
    syncSliderHandles();
    renderCountryList();
    if (state.view === "map")   { renderMap();   showZoomControls(); }
    if (state.view === "table") renderTable();
    if (state.view === "line")  renderLine();
    if (state.view === "bar")   renderBar();
  }

  function renderCountryList() {
    const q = els.countrySearch.property("value").trim().toLowerCase();
    const allRows = state.entities
      .map(e => ({ ...e, current: valueAtYear(e.values, state.endYear) }))
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .sort((a, b) => d3.descending(a.current ?? -Infinity, b.current ?? -Infinity) || d3.ascending(a.name, b.name));

    renderCountryRows(els.selectedList,  allRows.filter(d =>  state.selected.has(d.name)));
    renderCountryRows(els.countryList,   allRows.filter(d => !state.selected.has(d.name)));
  }

  function renderCountryRows(listSel, rows) {
    const join = listSel.selectAll("label.country-row").data(rows, d => d.name);
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
    merged.select(".country-value").text(d => d.current == null ? "" : fmtVal(d.current));

    merged.each(function(d) {
      const v = d.current;
      const binIdx = v == null ? 0 : CONFIG.thresholds.filter(t => v >= t).length;
      const pct = (binIdx / CONFIG.colors.length) * 100;
      this.style.setProperty("--bar-w", pct + "%");
    });
  }

  /* ── Projection ──────────────────────────────────────────────────────────── */
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

  /* ── Range / comparison mode ────────────────────────────────────────────── */
  function setRangeMode(active) {
    state.rangeActive = active;
    els.mapPair.classed("range-mode", active);
    els.compareBtn.classed("active", active);
    root.select("#slider-svg").select(".sl-left").style("display", active ? null : "none");
    if (!active) host.querySelector("#start-input").style.display = "none";
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

  /* ── Map rendering ───────────────────────────────────────────────────────── */
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
        return `country${v == null ? " no-data" : ""}`;
      })
      .attr("d", path)
      .style("fill", d => {
        const ent = entityForFeature(d);
        const v = ent ? valueAtYear(ent.values, year) : null;
        const c = v != null ? colorByValue(v) : null;
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

  /* ── Hover effects ──────────────────────────────────────────────────────── */
  function renderHoverEffects() {
    const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
    svgs.forEach(svg => {
      svg.selectAll(".country")
        .classed("hovered",  d => entityForFeature(d)?.name === state.hovered)
        .classed("selected", d => state.selected.has(entityForFeature(d)?.name))
        .classed("dimmed",   d => !!state.hovered && entityForFeature(d)?.name !== state.hovered);
    });
    root.selectAll(".country-row")
      .classed("active", d => state.selected.has(d.name) || state.hovered === d.name);
  }

  /* ── Legend & bucket highlight ──────────────────────────────────────────── */
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

  /* ── Tooltip ─────────────────────────────────────────────────────────────── */
  function showTooltip(event, ent, year) {
    const v = valueAtYear(ent.values, year);
    els.tooltip.classed("hidden", false)
      .html(`<h3>${ent.name}</h3><div>${year}: <strong>${labelByValue(v)}</strong></div><svg></svg>`);
    drawTinyLine(els.tooltip.select("svg"), ent.values, 260, 110, true, year);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const rect = host.querySelector("#map-view").getBoundingClientRect();
    els.tooltip
      .style("left", `${event.clientX - rect.left + 16}px`)
      .style("top",  `${event.clientY - rect.top  + 16}px`);
  }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  function renderTable() {
    const q    = els.tableSearch.property("value").trim().toLowerCase();
    const rows = state.entities
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
    </tr>`);

    const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
    join.exit().remove();
    const enter = join.enter().append("tr");
    enter.append("td").attr("class", "name-cell");
    enter.append("td").attr("class", "start-cell");
    enter.append("td").attr("class", "end-cell");
    enter.append("td").append("svg").attr("class", "sparkline");
    enter.append("td").attr("class", "abs-cell");

    const merged = join.merge(enter);
    merged.select(".name-cell").text(d => d.name);
    merged.select(".start-cell").text(d => d.sv == null ? "" : fmtVal(d.sv));
    merged.select(".end-cell").text(d => d.ev == null ? "" : fmtVal(d.ev));
    merged.select(".abs-cell").text(d =>
      d.change == null ? "" : `${d.change >= 0 ? "+" : ""}${fmtVal(d.change)}`);
    merged.select("svg").each(function (d) {
      drawTinyLine(d3.select(this), d.values, 150, 42, false);
    });
  }

  /* ── Line chart ──────────────────────────────────────────────────────────── */
  function renderLine() {
    const svg    = els.lineSvg;
    const node   = svg.node();
    const width  = node.clientWidth || 1000;
    const height = 520;
    const margin = { top: 24, right: 160, bottom: 44, left: 50 };
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

    const x = d3.scaleLinear().domain([state.startYear, state.endYear]).range([margin.left, width - margin.right]);
    const yMax = d3.max(entities.flatMap(e => e.inRange.map(d => d.value))) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]).nice();
    const colorOf = name => entityLineColor(name, entities);

    svg.append("g").selectAll("line")
      .data(y.ticks(6)).join("line")
      .attr("x1", margin.left).attr("x2", width - margin.right)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#e5e5e5").attr("stroke-dasharray", "4,3");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickSize(0))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick text").attr("x", -8).attr("font-size", 13).attr("fill", "#555"));

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(Math.min(12, state.endYear - state.startYear)).tickFormat(d3.format("d")).tickSizeOuter(0))
      .call(g => g.select(".domain").attr("stroke", "#ccc"))
      .call(g => g.selectAll(".tick line").attr("stroke", "#ccc"))
      .call(g => g.selectAll(".tick text").attr("font-size", 13).attr("fill", "#555"));

    const line = d3.line().defined(d => d.value != null).curve(lineCurve)
      .x(d => x(d.year)).y(d => y(d.value));

    entities.forEach(e => {
      svg.append("path")
        .datum(e.inRange).attr("class", "line-path entity-line").attr("data-entity", e.name)
        .attr("stroke", colorOf(e.name)).attr("d", line)
        .on("mouseenter", () => highlightLineEntity(svg, e.name))
        .on("mouseleave", () => clearLineHighlight(svg));
    });

    const labelItems = entities
      .map(e => { const last = e.inRange.at(-1); return last ? { name: e.name, lx: x(last.year), ly: y(last.value) } : null; })
      .filter(Boolean).sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < labelItems.length; i++) {
      if (labelItems[i].ly - labelItems[i - 1].ly < 15) labelItems[i].ly = labelItems[i - 1].ly + 15;
    }
    labelItems.forEach(d => {
      svg.append("text").attr("class", "entity-label").attr("data-entity", d.name)
        .attr("x", d.lx + 8).attr("y", d.ly).attr("dominant-baseline", "middle")
        .attr("font-size", 12).attr("fill", colorOf(d.name))
        .on("mouseenter", () => highlightLineEntity(svg, d.name))
        .on("mouseleave", () => clearLineHighlight(svg))
        .text(d.name);
    });
  }

  function highlightLineEntity(svg, name) {
    svg.selectAll(".entity-line")
      .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
      .attr("stroke-width", function() { return this.getAttribute("data-entity") === name ? 4 : 2; });
    svg.selectAll(".entity-label")
      .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
      .attr("font-weight", function() { return this.getAttribute("data-entity") === name ? "700" : "400"; });
  }
  function clearLineHighlight(svg) {
    svg.selectAll(".entity-line").style("opacity", 1).attr("stroke-width", 3);
    svg.selectAll(".entity-label").style("opacity", 1).attr("font-weight", "400");
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
        .call(d3.axisLeft(y).ticks(4));
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

  /* ── Bar chart (single year = endYear) ──────────────────────────────────── */
  function renderBar() {
    const BAR_COLOR = "#6475a3";
    const svg    = root.select("#bar-svg");
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
    const margin = { top: 8, right: 80, bottom: 8, left: 160 };
    const iW     = width - margin.left - margin.right;
    const iH     = barData.length * rowH;
    const height = iH + margin.top + margin.bottom;

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").selectAll("*").remove();

    const x = d3.scaleLinear().domain([0, d3.max(barData, d => d.value) * 1.08]).range([0, iW]);
    const y = d3.scaleBand().domain(barData.map(d => d.name)).range([0, iH]).padding(0.25);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .call(d3.axisLeft(y).tickSize(0))
      .call(ax => ax.select(".domain").remove())
      .selectAll("text").attr("fill", "#444").attr("font-size", "13px").attr("x", -8);

    g.selectAll(".bar")
      .data(barData).join("rect")
      .attr("class", "bar")
      .attr("x", 0).attr("y", d => y(d.name))
      .attr("height", y.bandwidth())
      .attr("width", d => Math.max(0, x(d.value)))
      .attr("fill", BAR_COLOR).attr("rx", 2);

    g.selectAll(".bar-label")
      .data(barData).join("text")
      .attr("class", "bar-label")
      .attr("x", d => x(d.value) + 5)
      .attr("y", d => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.35em").attr("fill", "#555").attr("font-size", "13px")
      .text(d => fmtVal(d.value));
  }

  /* ── SVG Slider ──────────────────────────────────────────────────────────── */
  function buildSlider() {
    const svgEl = host.querySelector("#slider-svg");
    if (!svgEl || !state.minYear) return;
    const svgD3 = d3.select(svgEl);
    const w     = svgEl.getBoundingClientRect().width || 400;
    const h = 28, R = sliderR, ty = sliderTy;
    sliderW = w;
    svgD3.selectAll("*").remove();
    svgD3.attr("height", h);
    sliderXScale = d3.scaleLinear().domain([state.minYear, state.maxYear]).range([R, w - R]);

    const startEl = host.querySelector("#start-input");
    const endEl   = host.querySelector("#end-input");

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
    const svgD3 = root.select("#slider-svg");
    const lx = sliderXScale(state.startYear), rx = sliderXScale(state.endYear);
    svgD3.select(".sl-left").attr("cx", lx);
    svgD3.select(".sl-right").attr("cx", rx);
    const rangeX = state.rangeActive ? lx : rx;
    svgD3.select(".sl-range").attr("x", rangeX).attr("width", Math.max(0, rx - rangeX));
    const startEl = host.querySelector("#start-input");
    const endEl   = host.querySelector("#end-input");
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
  function hideInput(el) { if (el && host.ownerDocument.activeElement !== el) el.style.display = "none"; }

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

  /* ── Playback ────────────────────────────────────────────────────────────── */
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

  /* ── Utilities ───────────────────────────────────────────────────────────── */
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

  /* ── Bootstrap ───────────────────────────────────────────────────────────── */
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  root.select("#source-text").text(CONFIG.source || "");

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
                     .filter(f => +f.id !== 10);

  buildIndexes();
  bindControls();
  renderAll();
  requestAnimationFrame(() => buildSlider());
}

// Standalone mode: index.html provides an empty <div id="standalone-root">
// and loads this file as <script type="module">. The bundled app never
// creates an element with that id — it calls index(container) itself via
// the d3Adapter — so this never double-mounts inside the React system.
const standaloneRoot = document.getElementById("standalone-root");
if (standaloneRoot) index(standaloneRoot);
