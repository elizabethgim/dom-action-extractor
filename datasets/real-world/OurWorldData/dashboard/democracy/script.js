import * as d3 from "d3";
import * as topojson from "topojson-client";

const STYLE_URL = new URL("./styles.css", import.meta.url);

const CONFIG = {
  csvUrl: "https://ourworldindata.org/grapher/political-regime.csv?v=1&csvType=full&useColumnShortNames=true",
  worldUrl: "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  title: "Democracy",
  subtitle: "Political regime classifications from Regimes of the World.",
  source: "V-Dem Project (2024); Regimes of the World",
  columns: { entity: "entity", code: "code", year: "year", value: "regime_row_owid" },
  categories: [
    { value: 0, label: "Closed autocracy", color: "#8f7374" },
    { value: 1, label: "Electoral autocracy", color: "#b89295" },
    { value: 2, label: "Electoral democracy", color: "#efcbd1" },
    { value: 3, label: "Liberal democracy", color: "#2c7fb8" },
  ],
  noDataColor: "#e8e4dc",
  initialSelected: ["World", "United States", "China", "India", "Germany", "France", "Brazil"],
};

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
          <button id="zoom-sel-btn" class="small-button hidden">Zoom to selection</button>
          <button id="reset-view-btn" class="small-button hidden">Reset view</button>
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
            <table id="data-table"><thead></thead><tbody></tbody></table>
          </div>
        </div>
        <div id="bar-view" class="view"><svg id="bar-svg" role="img"></svg></div>
        <div id="line-view" class="view active">
          <div id="tooltip" class="hidden"><div id="tip-name"></div><div id="tip-val"></div></div>
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
      <button class="sort-button">Sort by value, <span id="sort-year"></span></button>
      <div id="selection-section" class="hidden">
        <div class="selection-title"><span id="selection-count"></span><button id="clear-selection">Clear</button></div>
        <div id="selected-list"></div>
      </div>
      <div class="all-countries-label">All countries</div>
      <div id="country-list" class="country-list"></div>
    </aside>
  </main>
`;

const categoryByValue = new Map(CONFIG.categories.map((d) => [d.value, d]));

export async function index(host) {
  ensureStyles(host.ownerDocument);

  let app = host.querySelector("#app");
  if (!app) {
    host.innerHTML = MARKUP;
    app = host.querySelector("#app");
  }
  if (!app) return;

  const root = d3.select(app);
  const state = {
    view: "line",
    rows: [],
    entities: [],
    entityMap: new Map(),
    byCode: new Map(),
    byCountryName: new Map(),
    features: [],
    selected: new Set(),
    hovered: null,
    minYear: 0,
    maxYear: 0,
    endYear: 0,
    playing: false,
  };

  const els = {
    titleText: root.select("#title-text"),
    titleYear: root.select("#title-year"),
    subtitle: root.select("#subtitle"),
    tabs: root.selectAll(".tab"),
    views: root.selectAll(".view"),
    mapSvg: root.select("#map-svg"),
    lineSvg: root.select("#line-svg"),
    barSvg: root.select("#bar-svg"),
    tooltip: root.select("#map-tooltip"),
    lineTooltip: root.select("#tooltip"),
    countryList: root.select("#country-list"),
    selectedList: root.select("#selected-list"),
    selectionSection: root.select("#selection-section"),
    countrySearch: root.select("#country-search"),
    tableSearch: root.select("#table-search"),
    tableFilter: root.select("#table-filter-select"),
    startLabel: root.select("#start-label"),
    endLabel: root.select("#end-label"),
    sortYear: root.select("#sort-year"),
    selectionCount: root.select("#selection-count"),
    clearSelection: root.select("#clear-selection"),
    play: root.select("#play-button"),
    legend: root.select("#legend"),
    tableHead: root.select("#data-table thead"),
    tableBody: root.select("#data-table tbody"),
  };

  els.titleText.text(CONFIG.title);
  els.subtitle.text(CONFIG.subtitle);
  root.select("#source-text").text(CONFIG.source);
  drawLegend(els.legend);

  let csvRows;
  let world;
  try {
    [csvRows, world] = await Promise.all([
      d3.csv(CONFIG.csvUrl, parseRow),
      d3.json(CONFIG.worldUrl),
    ]);
  } catch (error) {
    els.titleText.text("Error loading data");
    console.error(error);
    return;
  }

  state.rows = csvRows.filter((d) => d.entity && Number.isFinite(d.year));
  state.features = topojson.feature(world, world.objects.countries).features.filter((f) => +f.id !== 10);
  buildIndexes(state);
  bindControls(root, state, els);
  renderAll(root, state, els);
}

function ensureStyles(doc) {
  if (doc.querySelector(`link[href="${STYLE_URL}"]`)) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLE_URL;
  doc.head.appendChild(link);
}

function parseRow(row) {
  const c = CONFIG.columns;
  const value = row[c.value] === "" || row[c.value] == null ? null : +row[c.value];
  return {
    entity: row[c.entity],
    code: normalizeCode(row[c.code]),
    year: +row[c.year],
    value: Number.isFinite(value) ? Math.round(value) : null,
  };
}

function buildIndexes(state) {
  const years = [...new Set(state.rows.map((d) => d.year))].sort(d3.ascending);
  state.minYear = d3.min(years);
  state.maxYear = d3.max(years);
  state.endYear = state.maxYear;

  const byEntity = d3.group(state.rows, (d) => d.entity);
  state.entities = [...byEntity.entries()]
    .map(([name, values]) => ({
      name,
      code: values.find((d) => d.code)?.code,
      values: values.sort((a, b) => d3.ascending(a.year, b.year)),
    }))
    .sort((a, b) => d3.ascending(a.name, b.name));

  state.entityMap = new Map(state.entities.map((d) => [d.name, d]));
  state.byCode = new Map(state.entities.filter((d) => d.code).map((d) => [d.code, d]));
  state.byCountryName = new Map(state.entities.map((d) => [normName(d.name), d]));
  CONFIG.initialSelected.forEach((name) => {
    if (state.entityMap.has(name)) state.selected.add(name);
  });
}

function bindControls(root, state, els) {
  els.tabs.on("click", (event) => {
    state.view = event.currentTarget.dataset.view;
    els.tabs.classed("active", function () { return this.dataset.view === state.view; });
    els.views.classed("active", function () { return this.id === `${state.view}-view`; });
    renderAll(root, state, els);
  });

  els.countrySearch.on("input", () => renderCountryList(root, state, els));
  els.tableSearch.on("input", () => renderTable(state, els));
  els.tableFilter.on("change", () => renderTable(state, els));
  els.clearSelection.on("click", () => {
    state.selected.clear();
    renderAll(root, state, els);
  });
  els.play.on("click", () => togglePlay(root, state, els));

  root.select("#slider-track").on("click", (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    state.endYear = Math.round(state.minYear + t * (state.maxYear - state.minYear));
    renderAll(root, state, els);
  });
}

function renderAll(root, state, els) {
  els.titleYear.text(`, ${state.endYear}`);
  els.startLabel.text(state.minYear);
  els.endLabel.text(state.endYear);
  els.sortYear.text(state.endYear);
  syncSlider(root, state);
  renderCountryList(root, state, els);
  renderSelectedList(root, state, els);
  renderTable(state, els);
  renderMap(root, state, els);
  renderLine(root, state, els);
  renderBar(root, state, els);
}

function renderCountryList(root, state, els) {
  const search = els.countrySearch.property("value").trim().toLowerCase();
  const rows = state.entities
    .filter((d) => !search || d.name.toLowerCase().includes(search))
    .map((d) => ({ ...d, current: valueAtYear(d.values, state.endYear) }))
    .sort((a, b) => d3.descending(a.current ?? -1, b.current ?? -1));

  const max = d3.max(rows, (d) => d.current ?? 0) || 1;
  els.countryList.selectAll(".country-row")
    .data(rows, (d) => d.name)
    .join("label")
    .attr("class", (d) => `country-row${state.selected.has(d.name) ? " active" : ""}`)
    .style("--bar-w", (d) => `${((d.current ?? 0) / max) * 100}%`)
    .on("click", (event, d) => {
      event.preventDefault();
      if (state.selected.has(d.name)) state.selected.delete(d.name);
      else state.selected.add(d.name);
      renderAll(root, state, els);
    })
    .html((d) => `
      <input type="checkbox" ${state.selected.has(d.name) ? "checked" : ""} />
      <span>${d.name}</span>
      <span class="country-value">${labelByValue(d.current)}</span>
    `);
}

function renderSelectedList(root, state, els) {
  const names = [...state.selected].filter((name) => state.entityMap.has(name));
  els.selectionSection.classed("hidden", names.length === 0);
  els.selectionCount.text(`${names.length} selected`);
  els.selectedList.selectAll(".country-row")
    .data(names, (d) => d)
    .join("label")
    .attr("class", "country-row active")
    .on("click", (event, name) => {
      event.preventDefault();
      state.selected.delete(name);
      renderAll(root, state, els);
    })
    .html((name) => `<input type="checkbox" checked /><span>${name}</span><span></span>`);
}

function renderMap(root, state, els) {
  const svg = els.mapSvg;
  const node = svg.node();
  const width = node?.clientWidth || 900;
  const height = 560;
  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
  const path = d3.geoPath(projection);

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();
  svg.append("defs").append("pattern")
    .attr("id", "diagonalHatch")
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8)
    .attr("height", 8)
    .append("path")
    .attr("d", "M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4")
    .attr("stroke", "#cfcfcf")
    .attr("stroke-width", 1);

  svg.append("g")
    .selectAll("path")
    .data(state.features)
    .join("path")
    .attr("class", (feature) => {
      const ent = entityForFeature(feature, state);
      const selected = ent && state.selected.has(ent.name);
      return `country${ent ? "" : " no-data"}${selected ? " selected" : ""}`;
    })
    .attr("fill", (feature) => {
      const ent = entityForFeature(feature, state);
      return colorByValue(ent ? valueAtYear(ent.values, state.endYear) : null);
    })
    .attr("d", path)
    .on("mousemove", (event, feature) => showMapTooltip(event, feature, state, els))
    .on("mouseleave", () => els.tooltip.classed("hidden", true))
    .on("click", (event, feature) => {
      const ent = entityForFeature(feature, state);
      if (!ent) return;
      if (state.selected.has(ent.name)) state.selected.delete(ent.name);
      else state.selected.add(ent.name);
      renderAll(root, state, els);
    });
}

function renderLine(root, state, els) {
  const svg = els.lineSvg;
  const node = svg.node();
  const width = node?.clientWidth || 900;
  const height = 560;
  const margin = { top: 28, right: 36, bottom: 44, left: 52 };
  const selected = selectedEntities(state);
  const x = d3.scaleLinear().domain([state.minYear, state.maxYear]).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([-0.2, 3.2]).range([height - margin.bottom, margin.top]);
  const color = d3.scaleOrdinal(selected.map((d) => d.name), d3.schemeTableau10);

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();
  svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).tickValues(CONFIG.categories.map((d) => d.value)).tickFormat((d) => categoryByValue.get(d)?.label ?? d));

  const line = d3.line()
    .defined((d) => d.value != null)
    .x((d) => x(d.year))
    .y((d) => y(d.value))
    .curve(d3.curveStepAfter);

  svg.append("g").selectAll("path")
    .data(selected)
    .join("path")
    .attr("class", "line-path")
    .attr("stroke", (d) => color(d.name))
    .attr("d", (d) => line(d.values));

  svg.append("g").selectAll("text")
    .data(selected)
    .join("text")
    .attr("x", width - margin.right + 4)
    .attr("y", (d) => y(valueAtYear(d.values, state.endYear) ?? 0))
    .attr("font-size", 12)
    .attr("fill", (d) => color(d.name))
    .text((d) => d.name);
}

function renderBar(root, state, els) {
  const svg = els.barSvg;
  const node = svg.node();
  const width = node?.clientWidth || 900;
  const rows = selectedEntities(state).map((d) => ({ name: d.name, value: valueAtYear(d.values, state.endYear) }));
  const height = Math.max(300, rows.length * 42 + 70);
  const margin = { top: 24, right: 28, bottom: 30, left: 190 };
  const x = d3.scaleLinear().domain([0, 3]).range([margin.left, width - margin.right]);
  const y = d3.scaleBand().domain(rows.map((d) => d.name)).range([margin.top, height - margin.bottom]).padding(0.25);

  svg.attr("viewBox", `0 0 ${width} ${height}`).selectAll("*").remove();
  svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickValues(CONFIG.categories.map((d) => d.value)).tickFormat((d) => categoryByValue.get(d)?.label ?? d));
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));
  svg.append("g").selectAll("rect")
    .data(rows)
    .join("rect")
    .attr("x", margin.left)
    .attr("y", (d) => y(d.name))
    .attr("width", (d) => x(d.value ?? 0) - margin.left)
    .attr("height", y.bandwidth())
    .attr("fill", (d) => colorByValue(d.value));
}

function renderTable(state, els) {
  const search = els.tableSearch.property("value").trim().toLowerCase();
  const mode = els.tableFilter.property("value") || "countries";
  let rows = state.entities.map((d) => ({ name: d.name, code: d.code, value: valueAtYear(d.values, state.endYear) }));
  if (mode === "selection") rows = rows.filter((d) => state.selected.has(d.name));
  if (mode === "countries") rows = rows.filter((d) => d.code && d.code.length === 3);
  if (search) rows = rows.filter((d) => d.name.toLowerCase().includes(search));

  els.tableHead.html("<tr><th>Entity</th><th>Code</th><th>Year</th><th>Regime</th></tr>");
  els.tableBody.selectAll("tr")
    .data(rows.sort((a, b) => d3.ascending(a.name, b.name)), (d) => d.name)
    .join("tr")
    .html((d) => `<td>${d.name}</td><td>${d.code || ""}</td><td>${state.endYear}</td><td>${labelByValue(d.value)}</td>`);
}

function drawLegend(legend) {
  legend.html("");
  const items = legend.selectAll(".legend-item")
    .data([...CONFIG.categories, { value: null, label: "No data", color: CONFIG.noDataColor }])
    .join("div")
    .attr("class", "legend-item")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px");
  items.append("span")
    .style("width", "16px")
    .style("height", "16px")
    .style("display", "inline-block")
    .style("background", (d) => d.color);
  items.append("span").text((d) => d.label);
}

function showMapTooltip(event, feature, state, els) {
  const ent = entityForFeature(feature, state);
  const value = ent ? valueAtYear(ent.values, state.endYear) : null;
  els.tooltip
    .classed("hidden", false)
    .style("left", `${event.offsetX + 14}px`)
    .style("top", `${event.offsetY + 14}px`)
    .html(`<h3>${ent?.name ?? feature.properties?.name ?? "Unknown"}</h3><div>${state.endYear}: ${labelByValue(value)}</div>`);
}

function selectedEntities(state) {
  const rows = [...state.selected].map((name) => state.entityMap.get(name)).filter(Boolean);
  return rows.length ? rows : state.entities.slice(0, 6);
}

function syncSlider(root, state) {
  const t = (state.endYear - state.minYear) / (state.maxYear - state.minYear || 1);
  root.select("#slider-fill").style("left", "0%").style("width", `${t * 100}%`);
  root.select("#handle-start").classed("hidden", true);
  root.select("#handle-end").style("left", `${t * 100}%`);
}

function togglePlay(root, state, els) {
  state.playing = !state.playing;
  els.play.text(state.playing ? "❚❚" : "▶");
  if (!state.playing) return;
  const timer = d3.interval(() => {
    if (!state.playing) return timer.stop();
    if (state.endYear >= state.maxYear) {
      state.playing = false;
      els.play.text("▶");
      timer.stop();
      return;
    }
    state.endYear += 1;
    renderAll(root, state, els);
  }, 180);
}

function entityForFeature(feature, state) {
  const id = normalizeCode(feature.id);
  return state.byCode.get(id) ?? state.byCountryName.get(normName(feature.properties?.name || ""));
}

function valueAtYear(values, year) {
  const exact = values.find((d) => d.year === year);
  if (exact) return exact.value;
  return values.filter((d) => d.year <= year && d.value != null).at(-1)?.value ?? null;
}

function colorByValue(value) {
  return value == null ? CONFIG.noDataColor : categoryByValue.get(+value)?.color ?? CONFIG.noDataColor;
}

function labelByValue(value) {
  return value == null ? "No data" : categoryByValue.get(+value)?.label ?? "No data";
}

function normalizeCode(code) {
  if (code == null) return "";
  const s = String(code).trim();
  return /^\d+$/.test(s) ? String(+s).padStart(3, "0") : s.toUpperCase();
}

function normName(value) {
  return String(value)
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

if (typeof document !== "undefined") {
  const standaloneApp = document.getElementById("app");
  if (standaloneApp) index(standaloneApp.ownerDocument.body);
}
