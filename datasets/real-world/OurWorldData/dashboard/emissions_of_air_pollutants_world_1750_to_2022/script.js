/*
  Multi-panel line chart — "Emissions of air pollutants, World, 1750 to 2022"
  One small-multiple panel per pollutant; each panel overlays one line per
  selected country/region (log y-scale, since values span many orders of
  magnitude over a quarter millennium).
*/
const CONFIG = {
  csvUrl: "https://ourworldindata.org/grapher/long-run-air-pollution.csv?v=1&csvType=full&useColumnShortNames=true",
  title:    "Emissions of air pollutants, World, 1750 to 2022",
  subtitle: "Air pollutants are gases that can lead to negative impacts on human health and ecosystems. Most are produced from energy, industry, and agriculture.",
  source:   "Hoesly et al. (2024) – Community Emissions Data System (CEDS)",
  initialSelected: ["World"],

  panels: [
    { key: "emissions__pollutant_nox__sector_all_sectors",    label: "Nitrogen oxides" },
    { key: "emissions__pollutant_so2__sector_all_sectors",    label: "Sulfur dioxide" },
    { key: "emissions__pollutant_co__sector_all_sectors",     label: "Carbon monoxide" },
    { key: "emissions__pollutant_bc__sector_all_sectors",     label: "Black carbon" },
    { key: "emissions__pollutant_nh3__sector_all_sectors",    label: "Ammonia" },
    { key: "emissions__pollutant_nmvoc__sector_all_sectors",  label: "Non-methane volatile organic compounds" },
  ],
};

/* per-entity line palette */
const LINE_COLORS = [
  "#4c6a9c", "#b13507", "#2d8168", "#6d3e91", "#c05917",
  "#286fa8", "#996d39", "#8c4569", "#3b8558", "#be5915",
];
function entityColor(name, entities) {
  const idx = entities.findIndex(e => e.name === name);
  return LINE_COLORS[idx >= 0 ? idx % LINE_COLORS.length : 0];
}


/* ── App state ────────────────────────────────────────────────────────────── */
const state = {
  view: "line",
  minYear: null, maxYear: null, startYear: null, endYear: null,
  rows: [], entities: [], entityMap: new Map(),
  selected: new Set(),
  hovered: null, playing: false,
};


/* ── DOM references ───────────────────────────────────────────────────────── */
const els = {
  titleText:        d3.select("#title-text"),
  titleYear:        d3.select("#title-year"),
  subtitle:         d3.select("#subtitle"),
  tabs:             d3.selectAll(".tab"),
  views:            d3.selectAll(".view"),
  chartsContainer:  d3.select("#charts-container"),
  lineLegend:       d3.select("#line-legend"),
  tooltip:          d3.select("#tooltip"),
  countryList:      d3.select("#country-list"),
  selectedList:     d3.select("#selected-list"),
  selectionSection: d3.select("#selection-section"),
  countrySearch:    d3.select("#country-search"),
  tableSearch:      d3.select("#table-search"),
  startLabel:       d3.select("#start-label"),
  endLabel:         d3.select("#end-label"),
  selectionCount:   d3.select("#selection-count"),
  clearSelection:   d3.select("#clear-selection"),
  play:             d3.select("#play-button"),
  tableHead:        d3.select("#data-table thead"),
  tableBody:        d3.select("#data-table tbody"),
};


/* ── Bootstrap ────────────────────────────────────────────────────────────── */
init();

async function init() {
  els.titleText.text(CONFIG.title);
  if (CONFIG.subtitle) els.subtitle.text(CONFIG.subtitle);
  d3.select("#source-text").text(CONFIG.source || "");
  d3.select("title").text(CONFIG.title || "Chart");

  let csvRows;
  try {
    csvRows = await d3.csv(CONFIG.csvUrl, parseRow);
  } catch (e) {
    els.titleText.text("Error loading data — check console.");
    console.error(e);
    return;
  }

  state.rows = csvRows.filter(d => d.entity && Number.isFinite(d.year));
  buildIndexes();
  bindControls();
  renderAll();
  initSlider();
}


/* ── Data parsing ─────────────────────────────────────────────────────────── */
function parseRow(d) {
  const row = { entity: d.entity, code: d.code, year: +d.year, values: {} };
  CONFIG.panels.forEach(p => {
    const raw = d[p.key];
    row.values[p.key] = raw !== "" && raw != null ? +raw : null;
  });
  return row;
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
  state.entityMap = new Map(state.entities.map(d => [d.name, d]));

  CONFIG.initialSelected.forEach(name => {
    if (state.entityMap.has(name)) state.selected.add(name);
  });
  if (!state.selected.size && state.entities.length) state.selected.add(state.entities[0].name);
}


/* ── Controls ────────────────────────────────────────────────────────────── */
function bindControls() {
  els.tabs.on("click", function () {
    state.view = this.dataset.view;
    els.tabs.classed("active", function () { return this.dataset.view === state.view; });
    els.views.classed("active", function () { return this.id === `${state.view}-view`; });
    renderAll();
  });

  els.countrySearch.on("input", renderCountryList);
  els.tableSearch.on("input", renderTable);
  els.clearSelection.on("click", () => { state.selected.clear(); renderAll(); });
  els.play.on("click", togglePlay);

  window.addEventListener("resize", debounce(renderAll, 120));
}


/* ── Render orchestration ─────────────────────────────────────────────────── */
function renderAll() {
  els.selectionSection.classed("hidden", !state.selected.size);
  els.selectionCount.text(`Selection (${state.selected.size})`);
  syncSliderHandles();
  renderCountryList();
  if (state.view === "line")  renderLineGrid();
  if (state.view === "table") renderTable();
  if (state.view === "bar")   renderBar();
}

function renderCountryList() {
  const q = els.countrySearch.property("value").trim().toLowerCase();
  const rows = state.entities.filter(e => !q || e.name.toLowerCase().includes(q));

  renderCountryRows(els.selectedList, rows.filter(d => state.selected.has(d.name)));
  renderCountryRows(els.countryList,  rows.filter(d => !state.selected.has(d.name)));
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
    .classed("active", d => state.selected.has(d.name))
    .on("click", (event, d) => {
      event.preventDefault();
      state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
      renderAll();
    });
  merged.select("input").property("checked", d => state.selected.has(d.name));
  merged.select(".country-name").text(d => d.name);
  merged.select(".country-value").text("");
}


/* ── Shared legend (only shown with 2+ entities selected) ────────────────── */
function drawLineLegend(entities) {
  els.lineLegend.classed("hidden", entities.length < 2);
  const join = els.lineLegend.selectAll(".area-legend-item").data(entities, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("div").attr("class", "area-legend-item");
  enter.append("span").attr("class", "area-legend-swatch");
  enter.append("span").attr("class", "area-legend-label");
  const merged = join.merge(enter);
  merged.select(".area-legend-swatch").style("background", d => entityColor(d.name, entities));
  merged.select(".area-legend-label").text(d => d.name);
  merged
    .style("cursor", "pointer")
    .on("mouseenter", (_, d) => highlightEntityEverywhere(d.name))
    .on("mouseleave", clearHighlightEverywhere);
}


/* ── Multi-panel line chart ───────────────────────────────────────────────── */
const chartRefs = []; // { x, y, svg, entities } per panel, for independent hover

function highlightPanelEntity(svg, name) {
  svg.selectAll(".entity-line")
    .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.25; })
    .attr("stroke-width", function() { return this.getAttribute("data-entity") === name ? 2.5 : 1.5; });
}
function clearPanelHighlight(svg) {
  svg.selectAll(".entity-line").style("opacity", 1).attr("stroke-width", 1.8);
}

// Hovering an entity, in the legend or any single panel's line, highlights
// that entity's line across every panel at once.
function highlightEntityEverywhere(name) {
  chartRefs.forEach(ref => highlightPanelEntity(ref.svg, name));
}
function clearHighlightEverywhere() {
  chartRefs.forEach(ref => clearPanelHighlight(ref.svg));
}

function renderLineGrid() {
  hideHover();

  const container = document.getElementById("charts-container");
  els.chartsContainer.html("");
  chartRefs.length = 0;

  const entities = [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean);
  drawLineLegend(entities);

  if (!entities.length) {
    els.chartsContainer.append("p")
      .style("padding", "20px").style("color", "#666")
      .text("Try adding countries and regions to display data.");
    return;
  }

  const containerW = container.getBoundingClientRect().width || 900;
  const cellW = Math.floor(containerW / 2);
  const svgW  = cellW - 32;

  CONFIG.panels.forEach(panel => {
    const cell = els.chartsContainer.append("div").attr("class", "chart-cell");
    const refs = drawLinePanel(cell, panel, entities, svgW);
    chartRefs.push(refs);
  });
}

function drawLinePanel(cell, panel, entities, totalW) {
  const margin = { top: 28, right: 18, bottom: 38, left: 56 };
  const totalH = 280;
  const w = totalW - margin.left - margin.right;
  const h = totalH - margin.top - margin.bottom;

  const svg = cell.append("svg")
    .attr("class", "line-mini-svg")
    .attr("viewBox", `0 0 ${totalW} ${totalH}`)
    .attr("width", totalW).attr("height", totalH);

  svg.append("text")
    .attr("x", margin.left).attr("y", 16)
    .style("font-size", "14px").style("font-weight", "700").style("fill", "#333")
    .text(panel.label);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const series = entities.map(e => ({
    name: e.name,
    pts: e.values
      .filter(d => d.year >= state.startYear && d.year <= state.endYear && d.values[panel.key] != null && d.values[panel.key] > 0)
      .map(d => ({ year: d.year, value: d.values[panel.key] })),
  })).filter(s => s.pts.length);

  const x = d3.scaleLinear().domain([state.startYear, state.endYear]).range([0, w]);

  const allVals = series.flatMap(s => s.pts.map(d => d.value));
  const yMin = d3.min(allVals) || 1;
  const yMax = d3.max(allVals) || 10;
  const y = d3.scaleLog().domain([Math.max(1, yMin * 0.8), yMax * 1.1]).range([h, 0]);

  /* log-scale gridlines at each power of ten within range */
  const yTicks = logTicks(y.domain());
  g.append("g").selectAll("line")
    .data(yTicks).join("line")
    .attr("x1", 0).attr("x2", w)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", "#dedede").attr("stroke-dasharray", "5,3");

  /* X axis */
  const xTicks = computeXTicks(state.startYear, state.endYear);
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.format("d")).tickSizeOuter(0))
    .call(ax => ax.select(".domain").attr("stroke", "#ccc"))
    .call(ax => ax.selectAll(".tick line").attr("stroke", "#ccc"))
    .call(ax => ax.selectAll(".tick text").style("font-size", "11px").style("fill", "#666"));

  /* Y axis (compact SI-ish labels: 1k, 100k, 10M, ...) */
  g.append("g")
    .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(fmtCompact).tickSize(0))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick text").attr("x", -8).style("font-size", "11px").style("fill", "#666"));

  /* lines */
  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  series.forEach(s => {
    g.append("path")
      .datum(s.pts)
      .attr("class", "entity-line")
      .attr("data-entity", s.name)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", entityColor(s.name, entities))
      .attr("stroke-width", 1.8)
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightEntityEverywhere(s.name))
      .on("mouseleave", clearHighlightEverywhere);
  });

  /* hover: vertical guideline + dot per entity + tooltip */
  const vLine = g.append("line")
    .attr("y1", 0).attr("y2", h)
    .attr("stroke", "#444").attr("stroke-width", 1)
    .style("display", "none");

  const dots = g.selectAll(".hover-dot")
    .data(series).join("circle")
    .attr("class", "hover-dot")
    .attr("r", 3.5)
    .attr("fill", s => entityColor(s.name, entities))
    .attr("stroke", "#fff").attr("stroke-width", 1)
    .style("display", "none");

  const refs = { x, y, svg, vLine, dots, series, panel };

  g.append("rect")
    .attr("width", w).attr("height", h)
    .attr("fill", "none").attr("pointer-events", "all")
    .style("cursor", "crosshair")
    .on("mousemove", function (event) {
      const [mx] = d3.pointer(event);
      const yr = clamp(Math.round(x.invert(mx)), state.startYear, state.endYear);
      showHover(yr, event, refs);
    })
    .on("mouseleave", () => hideHover(refs));

  return refs;
}

function showHover(yr, event, ref) {
  const cx = ref.x(yr);
  ref.vLine.attr("x1", cx).attr("x2", cx).style("display", null);

  const rows = [];
  ref.series.forEach(s => {
    const pt = s.pts.find(d => d.year === yr);
    ref.dots.filter(d => d.name === s.name)
      .attr("cx", pt ? cx : -999).attr("cy", pt ? ref.y(pt.value) : -999)
      .style("display", pt ? null : "none");
    if (pt) rows.push({ name: s.name, value: pt.value, color: entityColor(s.name, ref.series) });
  });

  if (!rows.length) return;

  const tipEl   = els.tooltip;
  const rowsHtml = rows.map(r =>
    `<div class="tip-row" style="--c:${r.color}">
       <span class="tip-dot"></span>
       <span class="tip-ename">${r.name}</span>
       <span class="tip-evalue">${fmtCompact(r.value)}</span>
     </div>`
  ).join("");

  tipEl.select("#tip-name").text(`${ref.panel.label} — ${yr}`);
  tipEl.select("#tip-val").html(rowsHtml);

  const lineViewRect = document.getElementById("line-view").getBoundingClientRect();
  let left = event.clientX - lineViewRect.left + 18;
  let top  = event.clientY - lineViewRect.top  - 20;
  if (left + 270 > lineViewRect.width) left = event.clientX - lineViewRect.left - 270;
  tipEl.classed("hidden", false).style("left", left + "px").style("top", top + "px");
}

function hideHover(ref) {
  if (ref) {
    ref.vLine.style("display", "none");
    ref.dots.style("display", "none");
  } else {
    chartRefs.forEach(r => { r.vLine.style("display", "none"); r.dots.style("display", "none"); });
  }
  els.tooltip.classed("hidden", true);
}

/* powers of ten spanning the domain, for log gridlines/ticks */
function logTicks([lo, hi]) {
  const ticks = [];
  for (let p = Math.floor(Math.log10(lo)); p <= Math.ceil(Math.log10(hi)); p++) {
    const v = Math.pow(10, p);
    if (v >= lo && v <= hi) ticks.push(v);
  }
  return ticks.length ? ticks : [lo, hi];
}

function fmtCompact(v) {
  if (v >= 1e6) return `${d3.format(",")(v / 1e6)}M`;
  if (v >= 1e3) return `${d3.format(",")(v / 1e3)}k`;
  return d3.format(",.0f")(v);
}

function computeXTicks(start, end) {
  const ticks = [start];
  const span = end - start;
  const step = span > 150 ? 50 : span > 50 ? 25 : 10;
  const firstStep = Math.ceil((start + 1) / step) * step;
  for (let yr = firstStep; yr <= end; yr += step) {
    if (yr - ticks.at(-1) >= step / 2) ticks.push(yr);
  }
  if (ticks.at(-1) !== end && end - ticks.at(-1) >= step / 4) ticks.push(end);
  return ticks;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }


/* ── Table ────────────────────────────────────────────────────────────────── */
function renderTable() {
  const q    = els.tableSearch.property("value").trim().toLowerCase();
  const year = state.endYear;

  const rows = state.entities
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .map(e => {
      const row = e.values.find(d => d.year === year);
      return {
        name: e.name,
        values: CONFIG.panels.map(p => row ? row.values[p.key] : null),
      };
    })
    .filter(d => d.values.some(v => v != null))
    .sort((a, b) => d3.ascending(a.name, b.name));

  els.tableHead.html(`<tr>
    <th>Country or region</th>
    ${CONFIG.panels.map(p => `<th>${p.label}</th>`).join("")}
  </tr>`);

  const join = els.tableBody.selectAll("tr").data(rows, d => d.name);
  join.exit().remove();
  const enter = join.enter().append("tr");
  enter.append("td").attr("class", "name-cell");
  CONFIG.panels.forEach((_, i) => enter.append("td").attr("class", `val-cell-${i}`));

  const merged = join.merge(enter);
  merged.select(".name-cell").text(d => d.name);
  CONFIG.panels.forEach((_, i) => {
    merged.select(`.val-cell-${i}`).text(d => d.values[i] != null ? fmtCompact(d.values[i]) : "");
  });
}


/* ── Bar chart view (single year = endYear, first selected pollutant) ───── */
function renderBar() {
  const BAR_COLOR = "#6475a3";
  const svg    = d3.select("#bar-svg");
  const node   = svg.node();
  const width  = node.clientWidth || 900;
  const year   = state.endYear;
  const panel  = CONFIG.panels[0];

  const entities = state.selected.size
    ? [...state.selected].map(n => state.entityMap.get(n)).filter(Boolean)
    : state.entities.slice(0, 10);

  const barData = entities
    .map(e => {
      const row = e.values.find(d => d.year === year);
      return { name: e.name, value: row ? row.values[panel.key] : null };
    })
    .filter(d => d.value != null)
    .sort((a, b) => d3.descending(a.value, b.value));

  if (!barData.length) { svg.selectAll("*").remove(); return; }

  const rowH   = 32;
  const margin = { top: 8, right: 90, bottom: 8, left: 160 };
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
    .attr("dy", "0.35em")
    .attr("fill", "#555").attr("font-size", "13px")
    .text(d => fmtCompact(d.value));
}


/* ── HTML Slider ───────────────────────────────────────────────────────────── */
function initSlider() {
  const track = document.getElementById("slider-track");
  if (!track || !state.minYear) return;

  function pctToYear(pct) {
    return Math.round(state.minYear + (pct / 100) * (state.maxYear - state.minYear));
  }

  function makeDraggable(handleId, isStart) {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    handle.addEventListener("mousedown", e => {
      e.preventDefault();
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

  const fill = document.getElementById("slider-fill");
  if (fill) {
    fill.addEventListener("mousedown", e => {
      e.preventDefault();
      const span    = state.endYear - state.startYear;
      const startX  = e.clientX;
      const startSY = state.startYear;
      const onMove  = ev => {
        const rect     = track.getBoundingClientRect();
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

  track.addEventListener("click", e => {
    if (e.target.classList.contains("slider-handle")) return;
    if (e.target.id === "slider-fill") return;
    const rect = track.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
    state.endYear = Math.max(state.startYear + 1, Math.min(state.maxYear, pctToYear(pct)));
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

  if (fill)   { fill.style.left = sp + "%"; fill.style.width = (ep - sp) + "%"; }
  if (hStart) hStart.style.left = sp + "%";
  if (hEnd)   hEnd.style.left   = ep + "%";

  els.startLabel.text(state.startYear);
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
    syncSliderHandles();
    renderAll();
  }, 60);
}


/* ── Utilities ────────────────────────────────────────────────────────────── */
function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}