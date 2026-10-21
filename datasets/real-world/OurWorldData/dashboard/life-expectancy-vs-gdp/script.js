/*
  Life expectancy vs. GDP per capita — OWID-style D3 scatter dashboard
  Data: UN World Population Prospects + Maddison Project Database via OurWorldInData
*/
import * as d3 from "d3";

// Works both bundled (Vite copies the asset and rewrites this to a hashed
// URL) and as a plain <script type="module"> in a browser (import.meta.url
// resolves to this file's own URL, so the relative path still works) —
// unlike `import "./styles.css"`, which only Vite understands.
const STYLE_URL = new URL("./styles.css", import.meta.url);

const CONFIG = {
  csvUrl: "https://ourworldindata.org/grapher/life-expectancy-vs-gdp-per-capita.csv?v=1&csvType=full&useColumnShortNames=true",
  title:    "Life expectancy vs. GDP per capita",
  subtitle: "Each bubble is a country in the selected year. Bubble size is population; color is continent. GDP per capita is shown on a logarithmic scale.",
  source:   "UN WPP (2024); Maddison Project Database (2023); OurWorldInData.org/grapher/life-expectancy-vs-gdp-per-capita | CC BY",

  columns: {
    entity: "entity", code: "code", year: "year",
    value:  "life_expectancy_0",      // y axis
    value2: "gdp_per_capita",         // x axis (log scale)
    size:   "population_historical", // bubble area
    region: "owid_region",
  },
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
        <button class="tab active" data-view="scatter">⏺ Scatter</button>
      </nav>

      <section class="visual-wrap">
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

        <div id="scatter-view" class="view active">
          <svg id="scatter-svg" role="img"></svg>
          <div id="scatter-tooltip" class="tooltip hidden"></div>
        </div>
      </section>

      <section class="year-control" aria-label="Year filter">
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
      <h2 id="side-title">HIGHLIGHT COUNTRIES</h2>
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

  host.classList.add("life-expectancy-vs-gdp-chart-host");
  host.innerHTML = MARKUP;
  const root = d3.select(host);

  /* ── Value formatters ────────────────────────────────────────────────────── */
  function fmtVal(v) {
    if (v == null) return "";
    return v.toFixed(1) + " yrs";
  }
  function fmtGdp(v) {
    if (v == null) return "";
    if (v >= 1000) return "$" + (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    return "$" + Math.round(v);
  }

  /* ── Continent colors ───────────────────────────────────────────────────── */
  const CONTINENT_COLORS = {
    "North America": "#e05b24",
    "South America": "#932834",
    "Africa":        "#9a5b88",
    "Europe":        "#4c6a9c",
    "Asia":          "#00847e",
    "Oceania":       "#5ab7c7",
  };
  const CONTINENT_ORDER = ["North America", "South America", "Africa", "Europe", "Asia", "Oceania"];

  /* ── App state ───────────────────────────────────────────────────────────── */
  const state = {
    view: "scatter",
    minYear: null, maxYear: null, startYear: null, endYear: null,
    selected: new Set(), hovered: null, playing: false,
    rows: [], entities: [], entityMap: new Map(),
  };

  /* ── DOM references ─────────────────────────────────────────────────────── */
  const els = {
    titleText:        root.select("#title-text"),
    titleYear:        root.select("#title-year"),
    subtitle:         root.select("#subtitle"),
    tabs:             root.selectAll(".tab"),
    views:            root.selectAll(".view"),
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
    tableHead:        root.select("#data-table thead"),
    tableBody:        root.select("#data-table tbody"),
    sideTitle:        root.select("#side-title"),
  };

  /* ── SVG slider state ───────────────────────────────────────────────────── */
  let sliderXScale = null, sliderW = 0;
  const sliderR = 7, sliderTy = 14;
  let sliderHoverG, sliderTipCircle, sliderTipBg, sliderTipTxt;

  /* ── Data parsing ────────────────────────────────────────────────────────── */
  function parseRow(d) {
    const c = CONFIG.columns;
    const num = k => { const raw = d[k]; return raw !== "" && raw != null && !isNaN(+raw) ? +raw : null; };
    return {
      entity: d[c.entity],
      code:   d[c.code] || "",
      year:   +d[c.year],
      value:  num(c.value),
      value2: num(c.value2),
      size:   num(c.size),
      region: d[c.region] || null,
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
      const region = values.find(d => d.region)?.region || null;
      return { name, region, values };
    }).filter(e => e.region); // keep countries, drop aggregates like "World"

    state.entityMap = new Map(state.entities.map(d => [d.name, d]));
    if (!state.selected.size) {
      ["United States", "China", "India", "Nigeria"].forEach(n => {
        if (state.entityMap.has(n)) state.selected.add(n);
      });
    }
  }

  /* ── Controls ────────────────────────────────────────────────────────────── */
  function bindControls() {
    els.tabs.on("click", function () {
      state.view = this.dataset.view;
      els.tabs.classed("active",  function () { return this.dataset.view === state.view; });
      els.views.classed("active", function () { return this.id === `${state.view}-view`; });
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
    endEl.addEventListener("change",    e => commitEnd(e.target.value));
    endEl.addEventListener("keydown",   e => { if (e.key === "Enter") { commitEnd(e.target.value); endEl.blur(); } });
    endEl.addEventListener("blur",      () => { endEl.style.display = "none"; });
    startEl.addEventListener("blur",    () => { startEl.style.display = "none"; });
  }

  /* ── Render orchestration ───────────────────────────────────────────────── */
  function renderAll() {
    els.titleYear.text(state.view === "scatter" ? `, ${state.endYear}` : "");
    els.sortYear.text(state.endYear);
    els.selectionSection.classed("hidden", !state.selected.size);
    els.selectionCount.text(`Selection (${state.selected.size})`);
    syncSliderHandles();
    renderCountryList();
    if (state.view === "table")   renderTable();
    if (state.view === "scatter") renderScatter();
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
  }

  function renderHoverEffects() {
    root.selectAll(".country-row")
      .classed("active", d => state.selected.has(d.name) || state.hovered === d.name);
    root.selectAll(".scatter-dot")
      .style("opacity", d => {
        if (state.selected.size) return state.selected.has(d.name) ? 1 : 0.25;
        return state.hovered && state.hovered !== d.name ? 0.3 : 0.85;
      });
  }

  /* ── Table ───────────────────────────────────────────────────────────────── */
  function renderTable() {
    const q    = els.tableSearch.property("value").trim().toLowerCase();
    const rows = state.entities
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .map(e => ({
        ...e,
        lifeExp: valueAtYear(e.values, state.endYear),
        gdp:     valueAtYear2(e.values, state.endYear),
      }))
      .sort((a, b) => d3.descending(a.lifeExp ?? -Infinity, b.lifeExp ?? -Infinity) || d3.ascending(a.name, b.name));

    els.tableHead.html(`<tr>
      <th>Country</th>
      <th>Continent</th>
      <th>Life expectancy (${state.endYear})</th>
      <th>GDP per capita (${state.endYear})</th>
    </tr>`);

    const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
    join.exit().remove();
    const enter = join.enter().append("tr");
    enter.append("td").attr("class", "name-cell");
    enter.append("td").attr("class", "region-cell");
    enter.append("td").attr("class", "life-cell");
    enter.append("td").attr("class", "gdp-cell");

    const merged = join.merge(enter);
    merged.select(".name-cell").text(d => d.name);
    merged.select(".region-cell").text(d => d.region || "");
    merged.select(".life-cell").text(d => d.lifeExp == null ? "" : fmtVal(d.lifeExp));
    merged.select(".gdp-cell").text(d => d.gdp == null ? "" : fmtGdp(d.gdp));
  }

  /* ── Scatter view ────────────────────────────────────────────────────────── */
  function renderScatter() {
    const svgNode = host.querySelector("#scatter-svg");
    const svg     = d3.select(svgNode);
    const width   = svgNode.clientWidth || 1000;
    const height  = 600;
    const margin  = { top: 30, right: 30, bottom: 50, left: 60 };
    svg.attr("viewBox", [0, 0, width, height]).selectAll("*").remove();

    const year = state.endYear;
    const data = state.entities
      .map(e => ({
        name: e.name, region: e.region,
        x: valueAtYear2(e.values, year),
        y: valueAtYear(e.values, year),
        size: valueAtSize(e.values, year),
      }))
      .filter(d => d.x != null && d.y != null && d.x > 0);

    if (!data.length) {
      svg.append("text").attr("x", margin.left).attr("y", 60).attr("fill", "#666").text("No data for this year");
      return;
    }

    const iW = width - margin.left - margin.right;
    const iH = height - margin.top - margin.bottom;

    const x = d3.scaleLog().domain(d3.extent(data, d => d.x)).range([0, iW]).nice();
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.y) * 1.05]).range([iH, 0]).nice();
    const r = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.size) || 1])
      .range([3, 32]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").selectAll("line")
      .data(y.ticks(6)).join("line")
      .attr("x1", 0).attr("x2", iW).attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", "#e5e5e5").attr("stroke-dasharray", "4,3");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSize(0))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick text").attr("x", -8).attr("font-size", 12).attr("fill", "#555"));

    g.append("g").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(6, "~s").tickFormat(d => fmtGdp(d)).tickSizeOuter(0))
      .call(ax => ax.select(".domain").attr("stroke", "#ccc"))
      .call(ax => ax.selectAll(".tick text").attr("font-size", 12).attr("fill", "#555"));

    g.append("text").attr("x", iW / 2).attr("y", iH + 42)
      .attr("text-anchor", "middle").attr("font-size", 13).attr("fill", "#555")
      .text("GDP per capita (log scale)");
    g.append("text").attr("transform", `rotate(-90)`).attr("x", -iH / 2).attr("y", -44)
      .attr("text-anchor", "middle").attr("font-size", 13).attr("fill", "#555")
      .text("Life expectancy at birth (years)");

    const colorOf = d => CONTINENT_COLORS[d.region] || "#999";
    const tip = root.select("#scatter-tooltip");

    const sorted = [...data].sort((a, b) => d3.descending(a.size || 0, b.size || 0)); // draw big bubbles first
    g.selectAll(".scatter-dot")
      .data(sorted, d => d.name).join("circle")
      .attr("class", "scatter-dot")
      .attr("cx", d => x(d.x)).attr("cy", d => y(d.y))
      .attr("r", d => r(d.size || 0))
      .attr("fill", colorOf)
      .style("opacity", d => {
        if (state.selected.size) return state.selected.has(d.name) ? 1 : 0.25;
        return 0.85;
      })
      .on("mouseenter", (event, d) => {
        state.hovered = d.name;
        tip.classed("hidden", false).html(
          `<h3>${d.name}</h3>
           <div style="color:${colorOf(d)};font-weight:600;margin-bottom:4px">${d.region || ""}</div>
           <div>Life expectancy: <strong>${fmtVal(d.y)}</strong></div>
           <div>GDP per capita: <strong>${fmtGdp(d.x)}</strong></div>`
        );
        moveScatterTooltip(event);
        renderCountryList();
      })
      .on("mousemove", event => moveScatterTooltip(event))
      .on("mouseleave", () => { state.hovered = null; tip.classed("hidden", true); renderCountryList(); })
      .on("click", (_, d) => {
        state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
        renderAll();
      });

    const labelData = data.filter(d => state.selected.has(d.name));
    g.selectAll(".scatter-label")
      .data(labelData, d => d.name).join("text")
      .attr("class", "scatter-label")
      .attr("x", d => x(d.x)).attr("y", d => y(d.y) - r(d.size || 0) - 4)
      .attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 700)
      .attr("fill", colorOf)
      .text(d => d.name);

    /* legend */
    const legendG = svg.append("g").attr("transform", `translate(${margin.left},10)`);
    const legendItemW = iW / CONTINENT_ORDER.length;
    CONTINENT_ORDER.forEach((cont, i) => {
      const lg = legendG.append("g").attr("transform", `translate(${i * legendItemW},0)`);
      lg.append("circle").attr("r", 5).attr("cy", -5).attr("fill", CONTINENT_COLORS[cont]);
      lg.append("text").attr("x", 10).attr("y", -1).attr("font-size", 11).attr("fill", "#444").text(cont);
    });
  }

  function moveScatterTooltip(event) {
    const rect = host.querySelector("#scatter-view").getBoundingClientRect();
    root.select("#scatter-tooltip")
      .style("left", `${event.clientX - rect.left + 16}px`)
      .style("top",  `${event.clientY - rect.top  - 20}px`);
  }

  /* ── SVG Slider (single-year scrubber) ──────────────────────────────────── */
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

    const endEl = host.querySelector("#end-input");

    svgD3.append("rect").attr("x", R).attr("y", ty - 4).attr("width", w - 2 * R).attr("height", 8)
      .attr("rx", 4).attr("fill", "#ddd");

    svgD3.append("rect").attr("class", "sl-range")
      .attr("y", ty - 4).attr("height", 8).attr("rx", 4).attr("fill", "#3a6abf")
      .attr("x", 0).attr("width", 0);

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
          state.endYear = clampYear(event.x, state.minYear, state.maxYear);
          updateHoverTip(sliderXScale(state.endYear), true);
          syncSliderHandles(); renderAll();
        })
        .on("end", () => { hideInput(endEl); sliderHoverG.style("display", "none"); }));

    svgD3.style("cursor", "pointer")
      .on("mousemove", function (event) { updateHoverTip(d3.pointer(event)[0]); })
      .on("mouseleave", () => sliderHoverG.style("display", "none"))
      .on("click", function (event) {
        if (event.target.tagName === "circle") return;
        const x  = d3.pointer(event)[0];
        state.endYear = Math.round(sliderXScale.invert(Math.max(R, Math.min(w - R, x))));
        sliderHoverG.style("display", "none");
        syncSliderHandles();
        renderAll();
      });

    syncSliderHandles();
  }

  function syncSliderHandles() {
    els.startLabel.text(state.minYear);
    els.endLabel.text(state.endYear);
    if (!sliderXScale) return;
    const svgD3 = root.select("#slider-svg");
    const rx = sliderXScale(state.endYear);
    svgD3.select(".sl-range").attr("x", 0).attr("width", Math.max(0, rx));
    svgD3.select(".sl-right").attr("cx", rx);
    const endEl = host.querySelector("#end-input");
    if (endEl) endEl.value = state.endYear;
  }

  function updateHoverTip(x, force = false) {
    if (!sliderXScale || !sliderHoverG) return;
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

  function commitEnd(raw) {
    const y = parseInt(raw, 10);
    if (isNaN(y)) { syncSliderHandles(); return; }
    state.endYear = Math.max(state.minYear, Math.min(state.maxYear, y));
    syncSliderHandles(); renderAll();
  }

  /* ── Playback ────────────────────────────────────────────────────────────── */
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
    }, 400);
  }

  /* ── Utilities ───────────────────────────────────────────────────────────── */
  function valueAtYear(values, year) {
    const exact = values.find(d => d.year === year);
    if (exact) return exact.value;
    return values.filter(d => d.year <= year && d.value != null).at(-1)?.value ?? null;
  }
  function valueAtYear2(values, year) {
    const exact = values.find(d => d.year === year);
    if (exact) return exact.value2;
    return values.filter(d => d.year <= year && d.value2 != null).at(-1)?.value2 ?? null;
  }
  function valueAtSize(values, year) {
    const exact = values.find(d => d.year === year);
    if (exact) return exact.size;
    return values.filter(d => d.year <= year && d.size != null).at(-1)?.size ?? null;
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  }

  /* ── Bootstrap ───────────────────────────────────────────────────────────── */
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  root.select("#source-text").text(CONFIG.source || "");

  let csvRows;
  try {
    csvRows = await d3.csv(CONFIG.csvUrl, parseRow);
  } catch (e) {
    els.titleText.text("Error loading data — check console.");
    console.error(e);
    return;
  }

  // restrict to the era with continuous annual data — pre-1900 rows are sparse
  // historical estimates and would make the year slider nearly useless
  state.rows = csvRows.filter(d => d.entity && Number.isFinite(d.year) && d.year >= 1900);
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
