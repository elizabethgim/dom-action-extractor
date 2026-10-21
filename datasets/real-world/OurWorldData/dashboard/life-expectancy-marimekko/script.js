/*
  Life expectancy — Marimekko view — OWID-style D3 dashboard
  Data: UN World Population Prospects (2024) / OurWorldInData
*/
import * as d3 from "d3";

// Works both bundled (Vite copies the asset and rewrites this to a hashed
// URL) and as a plain <script type="module"> in a browser (import.meta.url
// resolves to this file's own URL, so the relative path still works) —
// unlike `import "./styles.css"`, which only Vite understands.
const STYLE_URL = new URL("./styles.css", import.meta.url);

const CONFIG = {
  csvUrl: "https://ourworldindata.org/grapher/life-expectancy-marimekko.csv?v=1&csvType=full&useColumnShortNames=true",
  title:    "Life expectancy",
  subtitle: "Each bar is one country, grouped and colored by continent. Width is illustrative; height is life expectancy at birth in the selected year.",
  source:   "UN, World Population Prospects (2024); OurWorldInData.org/life-expectancy | CC BY",

  columns: { entity: "entity", code: "code", year: "year", value: "life_expectancy_0", region: "owid_region" },
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
        <button class="tab" data-view="table">Table</button>
        <button class="tab active" data-view="mekko">Marimekko</button>
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

        <div id="mekko-view" class="view active">
          <svg id="mekko-svg" role="img"></svg>
          <div id="mekko-tooltip" class="tooltip hidden"></div>
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

  host.classList.add("life-expectancy-marimekko-chart-host");
  host.innerHTML = MARKUP;
  const root = d3.select(host);

  /* ── Value formatter ────────────────────────────────────────────────────── */
  function fmtVal(v) {
    if (v == null) return "";
    return v.toFixed(1) + " yrs";
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
    view: "mekko",
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
    const raw = d[c.value];
    const value = raw !== "" && raw != null && !isNaN(+raw) ? +raw : null;
    return {
      entity: d[c.entity],
      code:   d[c.code] || "",
      year:   +d[c.year],
      value,
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
    }).filter(e => e.region); // keep countries (rows tagged with a continent), drop aggregates like "World"

    state.entityMap = new Map(state.entities.map(d => [d.name, d]));
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
    els.titleYear.text(state.view === "mekko" ? `, ${state.endYear}` : "");
    els.sortYear.text(state.endYear);
    els.selectionSection.classed("hidden", !state.selected.size);
    els.selectionCount.text(`Selection (${state.selected.size})`);
    syncSliderHandles();
    renderCountryList();
    if (state.view === "table") renderTable();
    if (state.view === "mekko") renderMekko();
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
    root.selectAll(".mekko-bar")
      .style("opacity", d => {
        if (state.selected.size) return state.selected.has(d.name) ? 1 : 0.3;
        return state.hovered && state.hovered !== d.name ? 0.4 : 1;
      });
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
      <th>Continent</th>
      <th>${state.startYear}</th>
      <th>${state.endYear}</th>
      <th>Change</th>
    </tr>`);

    const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
    join.exit().remove();
    const enter = join.enter().append("tr");
    enter.append("td").attr("class", "name-cell");
    enter.append("td").attr("class", "region-cell");
    enter.append("td").attr("class", "start-cell");
    enter.append("td").attr("class", "end-cell");
    enter.append("td").attr("class", "abs-cell");

    const merged = join.merge(enter);
    merged.select(".name-cell").text(d => d.name);
    merged.select(".region-cell").text(d => d.region || "");
    merged.select(".start-cell").text(d => d.sv == null ? "" : fmtVal(d.sv));
    merged.select(".end-cell").text(d => d.ev == null ? "" : fmtVal(d.ev));
    merged.select(".abs-cell").text(d =>
      d.change == null ? "" : `${d.change >= 0 ? "+" : ""}${d.change.toFixed(1)} yrs`);
  }

  /* ── Marimekko view ──────────────────────────────────────────────────────── */
  function renderMekko() {
    const svgNode = host.querySelector("#mekko-svg");
    const svg    = d3.select(svgNode);
    const width  = svgNode.clientWidth || 900;
    const year   = state.endYear;

    const legendH = 28;
    const chartH  = 380;
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

    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").selectAll("*").remove();

    const data = state.entities
      .map(e => ({ name: e.name, value: valueAtYear(e.values, year), continent: e.region }))
      .filter(d => d.value != null)
      .sort((a, b) => d3.descending(a.value, b.value));

    if (!data.length) {
      svg.append("text").attr("x", margin.left).attr("y", 60)
         .attr("fill", "#666").text("No data for this year");
      return;
    }

    const n    = data.length;
    const barW = iW / n;
    const barColor = d => CONTINENT_COLORS[d.continent] || "#aaa";

    const activeContinents = new Set(
      [...state.selected].map(name => state.entityMap.get(name)?.region).filter(Boolean)
    );
    const legendG = svg.append("g").attr("transform", `translate(${margin.left},8)`);
    const legendItemW = iW / CONTINENT_ORDER.length;
    CONTINENT_ORDER.forEach((cont, i) => {
      const isActive = !state.selected.size || activeContinents.has(cont);
      const lg = legendG.append("g").attr("transform", `translate(${i * legendItemW},0)`);
      lg.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2)
        .attr("fill", CONTINENT_COLORS[cont]).style("opacity", isActive ? 1 : 0.35);
      lg.append("text").attr("x", 17).attr("y", 10).attr("font-size", 10)
        .attr("font-weight", isActive ? 700 : 400).attr("fill", isActive ? "#222" : "#aaa")
        .text(cont);
    });

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const yMax = d3.max(data, d => d.value) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).range([iH, 0]).nice();

    const yTicks = y.ticks(6);
    g.append("g").selectAll("line")
      .data(yTicks).join("line")
      .attr("x1", 0).attr("x2", iW)
      .attr("y1", d => y(d)).attr("y2", d => y(d))
      .attr("stroke", d => d === 0 ? "#bbb" : "#e5e5e5");

    g.append("g")
      .call(d3.axisLeft(y).tickValues(yTicks).tickSize(0))
      .call(ax => ax.select(".domain").remove())
      .call(ax => ax.selectAll(".tick text").attr("x", -8).attr("font-size", 12).attr("fill", "#555"));

    const hasSelection = state.selected.size > 0;
    const mekkoTip = root.select("#mekko-tooltip");

    g.selectAll(".mekko-bar")
      .data(data).join("rect")
      .attr("class", "mekko-bar")
      .attr("x", (_, i) => i * barW)
      .attr("y", d => y(d.value))
      .attr("width", Math.max(1, barW - 0.5))
      .attr("height", d => iH - y(d.value))
      .attr("fill", barColor)
      .attr("stroke", d => state.selected.has(d.name) ? barColor(d) : "none")
      .attr("stroke-width", 0.75)
      .style("opacity", d => {
        if (hasSelection) return state.selected.has(d.name) ? 1 : 0.3;
        return state.hovered && state.hovered !== d.name ? 0.4 : 1;
      })
      .on("mouseenter", (event, d) => {
        state.hovered = d.name;
        mekkoTip.classed("hidden", false).html(
          `<h3>${d.name}</h3>
           <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
           <div>${year}: <strong>${fmtVal(d.value)}</strong></div>`
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
        state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
        renderAll();
      });

    const step = Math.max(1, Math.round(n / 18));
    const sampleIdx = new Set();
    for (let i = 0; i < n; i += step) sampleIdx.add(i);

    const selIdx = new Set();
    state.selected.forEach(name => {
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

    const MIN_LABEL_GAP = 15;
    const CHAR_W = 10.5;
    labelData.forEach(d => {
      d.labelX  = d.naturalX;
      d.gapNeed = Math.max(MIN_LABEL_GAP, d.name.length * CHAR_W * Math.SQRT1_2);
      d.depth = 0;
    });

    if (state.selected.size > 0) {
      for (let k = 1; k < labelData.length; k++) {
        const need = Math.max(labelData[k - 1].gapNeed, labelData[k].gapNeed);
        if (labelData[k].labelX - labelData[k - 1].labelX < need) {
          labelData[k].labelX = labelData[k - 1].labelX + need;
        }
      }
    } else {
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

    g.append("g").attr("class", "mekko-label-lines")
      .selectAll("path")
      .data(labelData).join("path")
      .attr("d", d => {
          const textY = iH + labelGap + d.depth * depthStep;
          if (d.naturalX === d.labelX) return `M${d.naturalX},${iH} L${d.labelX},${textY}`;
          const elbowY = textY - 6;
          return `M${d.naturalX},${iH} L${d.naturalX},${elbowY} L${d.labelX},${elbowY} L${d.labelX},${textY}`;
        })
      .attr("fill", "none").attr("stroke", "#aaa").attr("stroke-width", 1);

    g.append("g").attr("class", "mekko-labels")
      .selectAll("text")
      .data(labelData).join("text")
      .attr("transform", d => `translate(${d.labelX},${iH + labelGap + d.depth * depthStep}) rotate(-45)`)
      .attr("text-anchor", "end").attr("dx", "-5px").attr("dy", ".32em")
      .attr("font-size", 13).attr("font-weight", 700).attr("fill", barColor)
      .text(d => d.name)
      .on("mouseenter", (event, d) => {
        state.hovered = d.name;
        mekkoTip.classed("hidden", false).html(
          `<h3>${d.name}</h3>
           <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
           <div>${year}: <strong>${fmtVal(d.value)}</strong></div>`
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
        state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
        renderAll();
      });
  }

  function moveMekkoTooltip(event) {
    const rect = host.querySelector("#mekko-view").getBoundingClientRect();
    root.select("#mekko-tooltip")
      .style("left", `${event.clientX - rect.left + 16}px`)
      .style("top",  `${event.clientY - rect.top  - 40}px`);
  }

  /* ── SVG Slider (single-year scrubber; left handle stays hidden) ───────────── */
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

  function changeBetween(values, a, b) {
    const av = valueAtYear(values, a), bv = valueAtYear(values, b);
    return av == null || bv == null ? null : bv - av;
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
  // historical estimates (decades/centuries apart) and would make the year
  // slider nearly useless for picking a specific year
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
