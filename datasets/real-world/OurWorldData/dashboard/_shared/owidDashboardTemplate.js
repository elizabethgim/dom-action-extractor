import * as d3 from "d3";
import * as topojson from "topojson-client";

// Shared by ~90 OurWorldInData chart directories (Table/Map/Line/Bar tabs).
// Each chart's own script.js just imports createOwidDashboardIndex, passes
// its CONFIG, and re-exports the resulting index(host) function — instead
// of duplicating this ~1100-line template per chart.
//
// Works both bundled (Vite copies the CSS asset and rewrites this to a
// hashed URL) and as a plain <script type="module"> in a browser
// (import.meta.url resolves to this module's own URL, so the relative path
// still works) — unlike `import "./styles.css"`, which only Vite
// understands.
const STYLE_URL = new URL("./owidDashboardTemplate.css", import.meta.url);
const HOST_CLASS = "owid-dashboard-host";

const MARKUP = `
  <main class="owid-card" id="app">
    <section class="chart-panel">
      <header class="chart-header">
        <div>
          <h1 id="title"><span id="title-text"></span><span id="title-year"></span></h1>
          <p class="subtitle" id="subtitle"></p>
        </div>
      </header>

      <div class="tabs-row">
        <nav class="tabs" aria-label="Visualization tabs">
          <button class="tab" data-view="table">Table</button>
          <button class="tab" data-view="map">Map</button>
          <button class="tab active" data-view="line">Line</button>
          <button class="tab" data-view="bar">Bar</button>
        </nav>
        <div id="map-controls">
          <button id="zoom-sel-btn"  class="small-button hidden">⊙ Zoom to selection</button>
          <button id="reset-view-btn" class="small-button hidden">↺ Reset view</button>
          <select id="region-select" class="region-select hidden">
            <option value="world">World</option>
            <option value="africa">Africa</option>
            <option value="northamerica">North America</option>
            <option value="southamerica">South America</option>
            <option value="asia">Asia</option>
            <option value="europe">Europe</option>
            <option value="oceania">Oceania</option>
          </select>
        </div>
      </div>

      <section class="visual-wrap">
        <div id="map-view" class="view">
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
            <div class="table-right-tools">
              <select id="table-filter-select" class="table-filter-select">
                <option value="all">All</option>
                <option value="selection">Selection</option>
                <option value="countries" selected>Countries</option>
              </select>
              <input id="table-search" type="search" placeholder="Search for a country" />
            </div>
          </div>
          <div class="data-table-wrap">
            <table id="data-table">
              <thead></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div id="bar-view" class="view">
          <svg id="bar-svg" role="img"></svg>
        </div>

        <div id="line-view" class="view active">
          <div id="tooltip" class="hidden">
            <div id="tip-name"></div>
            <div id="tip-val"></div>
          </div>
          <svg id="line-svg" role="img"></svg>
        </div>
      </section>

      <section class="year-control" aria-label="Year range filter">
        <button id="play-button" class="play" aria-label="Play animation">▶</button>
        <span id="start-label" class="year-label"></span>
        <div class="slider-wrap">
          <div id="slider-track">
            <div id="slider-fill"></div>
            <div class="slider-handle ghost-handle hidden" id="handle-ghost"></div>
            <div class="slider-handle" id="handle-start"></div>
            <div class="slider-handle" id="handle-end"></div>
          </div>
        </div>
        <span id="end-label" class="year-label"></span>
      </section>

      <footer class="chart-footer">
        <p><strong>Data source:</strong> <span id="source-text"></span></p>
      </footer>
    </section>

    <aside class="side-panel">
      <h2 id="side-title">SELECT COUNTRIES</h2>
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



export function createOwidDashboardIndex(CONFIG) {
  return async function index(host) {

    const doc = host.ownerDocument;
    if (!doc.querySelector(`link[href="${STYLE_URL}"]`)) {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLE_URL;
      doc.head.appendChild(link);
    }

    host.classList.add(HOST_CLASS);
    host.innerHTML = MARKUP;
    const root = d3.select(host);

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
      view: "line",
      minYear: null, maxYear: null, startYear: null, endYear: null,
      selected: new Set(),    // Line / Bar / Table selection
      mapSelected: new Set(), // Map-only selection
      hovered: null, playing: false,
      rows: [], entities: [], entityMap: new Map(),
      byCode: new Map(), byCountryName: new Map(),
      world: null, features: [], centroids: new Map(),
      isZoomed: false, rangeActive: false, region: "world",
      tableFilter: "countries",
    };

    function activeSelection() {
      return state.view === "map" ? state.mapSelected : state.selected;
    }


    /* ── DOM references ───────────────────────────────────────────────────────── */
    const els = {
      titleText:     root.select("#title-text"),
      titleYear:     root.select("#title-year"),
      subtitle:      root.select("#subtitle"),
      tabs:          root.selectAll(".tab"),
      views:         root.selectAll(".view"),
      mapSvg:        root.select("#map-svg"),
      mapLeft:       root.select("#map-left"),
      mapPair:       root.select("#map-pair"),
      lineSvg:       root.select("#line-svg"),
      tooltip:       root.select("#map-tooltip"),
      countryList:      root.select("#country-list"),
      selectedList:     root.select("#selected-list"),
      selectionSection: root.select("#selection-section"),
      countrySearch: root.select("#country-search"),
      tableSearch:   root.select("#table-search"),
      startLabel:    root.select("#start-label"),
      endLabel:      root.select("#end-label"),
      sortYear:      root.select("#sort-year"),
      selectionCount:  root.select("#selection-count"),
      clearSelection:  root.select("#clear-selection"),
      play:          root.select("#play-button"),
      legend:        root.select("#legend"),
      tableHead:     root.select("#data-table thead"),
      tableBody:     root.select("#data-table tbody"),
      sideTitle:     root.select("#side-title"),
      zoomSelBtn:    root.select("#zoom-sel-btn"),
      resetViewBtn:  root.select("#reset-view-btn"),
      regionSelect:  root.select("#region-select"),
    };


    /* ── Bootstrap ────────────────────────────────────────────────────────────── */
    init();

    async function init() {
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
    function bindControls() {
      els.tabs.on("click", function () {
        const prevView = state.view;
        state.view = this.dataset.view;

        els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
        els.views.classed("active", function () { return this.id === `${state.view}-view`; });
        const lineOrBar = v => v === "line" || v === "bar";
        els.sideTitle.text(lineOrBar(state.view) ? "ADD/REMOVE COUNTRIES AND REGIONS" : "SELECT COUNTRIES");
        // Hide side panel for Table tab; show for all others
        root.select(".side-panel").classed("hidden", state.view === "table");
        showMapControls();
        renderAll();
      });

      els.countrySearch.on("input", renderCountryList);
      els.tableSearch.on("input",   renderTable);
      root.select("#table-filter-select").on("change", function () {
        state.tableFilter = this.value;
        renderTable();
      });
      els.clearSelection.on("click", () => { activeSelection().clear(); renderAll(); });
      els.play.on("click", togglePlay);

      const onResize = debounce(() => {
        if (!host.isConnected) { window.removeEventListener("resize", onResize); return; }
        renderAll();
      }, 120);
      window.addEventListener("resize", onResize);

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
      const yearTxt = (state.view === "map" || state.view === "bar") ? `, ${state.endYear}` : "";
      els.titleYear.text(yearTxt);
      els.sortYear.text(state.endYear);
      els.selectionSection.classed("hidden", !activeSelection().size);
      els.selectionCount.text(`Selection (${activeSelection().size})`);
      syncSliderHandles();
      root.select(".side-panel").classed("hidden", state.view === "table");
      renderCountryList();
      if (state.view === "map")   { renderMap();   showMapControls(); }
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
          const s = activeSelection(); s.has(d.name) ? s.delete(d.name) : s.add(d.name);
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
        const features = state.features.filter(f => state.mapSelected.has(featureKey(f)));
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
      root.select("#map-controls").classed("hidden", state.view !== "map");
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
          const key = featureKey(d);
          state.mapSelected.has(key) ? state.mapSelected.delete(key) : state.mapSelected.add(key);
          renderAll();
        });

      /* Value labels — only for selected countries */
      const labelData = state.features
        .map(f => {
          const ent = entityForFeature(f);
          const v   = ent ? valueAtYear(ent.values, year) : null;
          if (v == null || !state.mapSelected.has(featureKey(f))) return null;
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
        .classed("selected", d => state.mapSelected.has(featureKey(d)))
        .classed("dimmed",   d => !!state.hovered && entityForFeature(d)?.name !== state.hovered));
      root.selectAll(".country-row")
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
      const rect = host.querySelector("#map-view").getBoundingClientRect();
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
      const filterSel = host.querySelector("#table-filter-select");
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
          .on("mouseenter", () => highlightEntity(e.name))
          .on("mouseleave", clearEntityHighlight);
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
          .on("mouseenter", () => highlightEntity(d.name))
          .on("mouseleave", clearEntityHighlight)
          .text(d.name);
      });

      function highlightEntity(name) {
        svg.selectAll(".entity-line")
          .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
          .attr("stroke-width", function() { return this.getAttribute("data-entity") === name ? 2.5 : 1.5; });
        svg.selectAll(".entity-label")
          .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
          .attr("font-weight", function() { return this.getAttribute("data-entity") === name ? "700" : "400" ; });
      }

      function clearEntityHighlight() {
        svg.selectAll(".entity-line")
          .style("opacity", 1)
          .attr("stroke-width", 2);
        svg.selectAll(".entity-label")
          .style("opacity", 1)
          .attr("font-weight", "400");
      }

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

      const tipEl   = root.select("#tooltip");
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

          const lineViewRect = host.querySelector("#line-view").getBoundingClientRect();
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
      const margin = { top: 8, right: 70, bottom: 8, left: 160 };
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

      const line = d3.line().defined(d => d.value != null).curve(lineCurve)
        .x(d => x(d.year)).y(d => y(d.value));
      svg.append("path").datum(filtered)
        .attr("d", line).attr("fill", "none")
        .attr("stroke", "var(--axis-blue)").attr("stroke-width", axes ? 2.5 : 2);

      if (axes) {
        // Map tooltip: single marker dot
        const yr  = markerYear ?? state.endYear;
        const dot = filtered.find(d => d.year === yr) || filtered.at(-1);
        if (dot) {
          svg.append("circle")
            .attr("cx", x(dot.year)).attr("cy", y(dot.value))
            .attr("r", 4).attr("fill", "var(--axis-blue)");
        }
      } else {
        // Table sparkline: dots at startYear (spike start) and endYear
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
    function initSlider() {
      const track = host.querySelector("#slider-track");
      if (!track || !state.minYear) return;

      function pctToYear(pct) {
        return Math.round(state.minYear + (pct / 100) * (state.maxYear - state.minYear));
      }

      function makeDraggable(handleId, isStart) {
        const handle = host.querySelector("#" + handleId);
        if (!handle) return;
        handle.addEventListener("mousedown", e => {
          e.preventDefault();
          e.stopPropagation();
          const onMove = ev => {
            const rect = track.getBoundingClientRect();
            const pct  = Math.max(0, Math.min(100, (ev.clientX - rect.left) / rect.width * 100));
            const yr   = pctToYear(pct);
            if (isStart) state.startYear = Math.min(yr, state.endYear - 1);
            else         state.endYear   = Math.max(yr, state.startYear + 1);
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

      makeDraggable("handle-start", true);
      makeDraggable("handle-end",   false);

      /* fill bar drag: shift both handles while preserving span */
      const fill = host.querySelector("#slider-fill");
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
      const ghost = host.querySelector("#handle-ghost");
      track.addEventListener("mousemove", e => {
        if (state.view !== "map" || state.rangeActive) { ghost.classList.add("hidden"); return; }
        const rect = track.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        const yr   = pctToYear(pct);
        if (yr >= state.endYear) { ghost.classList.add("hidden"); return; }
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
        state.startYear   = Math.min(pctToYear(pct), state.endYear - 1);
        state.rangeActive = true;
        ghost.classList.add("hidden");
        els.mapPair.classed("range-mode", true);
        syncSliderHandles();
        renderAll();
        showMapControls();
      });

      track.addEventListener("click", e => {
        if (e.target.classList.contains("slider-handle")) return;
        if (e.target.id === "slider-fill") return;
        if (e.target.id === "handle-ghost") return;
        const rect = track.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
        if (state.rangeActive) {
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
      const fill   = host.querySelector("#slider-fill");
      const hStart = host.querySelector("#handle-start");
      const hEnd   = host.querySelector("#handle-end");

      // Map tab without compare mode: single handle (hide start)
      // Table, Line, Bar + map compare mode: two handles
      const showStart = state.rangeActive || state.view !== "map";

      if (showStart) {
        if (fill)   { fill.style.left = sp + "%"; fill.style.width = (ep - sp) + "%"; }
        if (hStart) { hStart.style.left = sp + "%"; hStart.classList.remove("hidden"); }
        els.startLabel.text(state.startYear);
      } else {
        if (fill)   { fill.style.left = "0%"; fill.style.width = ep + "%"; }
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

  };
}
