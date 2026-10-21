// ─────────────────────────────────────────────────────────────────
//  CO₂ Long-Term Concentration Chart  (OWID-style)
//  Data: synthetic approximation of 800k-year ice core + Mauna Loa
//  To use real data: replace generateData() with a d3.csv() fetch
// ─────────────────────────────────────────────────────────────────
import * as d3 from "d3";

const STYLE_URL = new URL("./style.css", import.meta.url);

const MARKUP = `
  <div id="app">
    <div id="header">
      <h1 id="main-title">Carbon dioxide concentration in the atmosphere</h1>
      <p id="subtitle">
        Atmospheric carbon dioxide (CO₂) concentration is measured in parts per million (ppm). Long-term trends in CO₂ concentrations can be measured at high-resolution using
preserved air samples from ice cores.
      </p>
      <div id="tab-row">
        <div id="tabs">
          <button class="tabs">Table</button>
          <button class="tabs">Line</button>
        </div>
      </div>
    </div>

    <div id="main-content">
      <div id="line-section">
      </div>
      <div id="time-controls">
      </div>
    </div>

    <div id="footer">
      <strong>Data source:</strong> NOAA Global Monitoring Laboratory – Trends in Atmospheric Carbon Dioxide (2026); EPA based on various sources (2022) &nbsp;·&nbsp;
      <a href="https://ourworldindata.org/grapher/co2-long-term-concentration" target="_blank">OurWorldInData.org/climate-change</a> | CC BY
    </div>
  </div>
`;

// ── Data generation ────────────────────────────────────────────
// Mimics Vostok/EPICA ice core patterns + modern Mauna Loa record.
// X axis: years CE. Pre-CE values are negative (e.g. -803719 = 803,719 BCE).
// Y axis: CO₂ in ppm.
function generateData() {
  const data = [];

  // ── Deep paleoclimate (ice core): 803,719 BCE → 10,000 BCE ───
  // Milankovitch cycles: primary ~100k-yr + 40k-yr + 23k-yr harmonics
  const START_YR = -803719;
  const HOLOCENE_START = -10000;
  const step = 500;

  for (let y = START_YR; y <= HOLOCENE_START; y += step) {
    const t = (y - START_YR) / 1000; // kyr from start
    const cycle100k = Math.sin(2 * Math.PI * t / 100) * 35;
    const cycle41k  = Math.sin(2 * Math.PI * t / 41  + 0.8) * 12;
    const cycle23k  = Math.sin(2 * Math.PI * t / 23  + 1.4) * 8;
    const mis11 = Math.exp(-Math.pow((y + 410000) / 8000, 2)) * 10;
    const base = 228 + cycle100k + cycle41k + cycle23k + mis11;
    const noise = (Math.random() - 0.5) * 6;
    data.push({ year: y, co2: Math.max(170, Math.min(310, base + noise)) });
  }

  // ── Holocene: 10,000 BCE → 1800 CE ───────────────────────────
  // Stable interglacial: rises gently from ~260 to ~280 ppm
  for (let y = HOLOCENE_START + step; y <= 1800; y += step) {
    const frac = (y - HOLOCENE_START) / (1800 - HOLOCENE_START);
    const base = 260 + frac * 18; // gentle rise 260→278
    const noise = (Math.random() - 0.5) * 2;
    data.push({ year: y, co2: base + noise });
  }

  // ── Industrial era: 1800 → 1958 ──────────────────────────────
  const industrialStart = 280;
  for (let y = 1805; y < 1958; y += 5) {
    const frac = (y - 1800) / 158;
    const co2 = industrialStart + Math.pow(frac, 1.4) * 35;
    data.push({ year: y, co2: co2 + (Math.random() - 0.5) * 1.5 });
  }

  // ── Mauna Loa era: 1958 → 2025 (annual means) ────────────────
  const maunaLoa = [
    [1958,315.3],[1959,315.97],[1960,316.9],[1961,317.64],[1962,318.45],
    [1963,318.99],[1964,319.62],[1965,320.04],[1966,321.38],[1967,322.18],
    [1968,323.05],[1969,324.62],[1970,325.68],[1971,326.32],[1972,327.45],
    [1973,329.68],[1974,330.25],[1975,331.15],[1976,332.15],[1977,333.9],
    [1978,335.5],[1979,336.85],[1980,338.7],[1981,340.1],[1982,341.45],
    [1983,343.05],[1984,344.6],[1985,346.2],[1986,347.6],[1987,349.35],
    [1988,351.6],[1989,353.0],[1990,354.4],[1991,355.6],[1992,356.45],
    [1993,357.1],[1994,358.9],[1995,360.9],[1996,362.6],[1997,363.8],
    [1998,366.7],[1999,368.4],[2000,369.6],[2001,371.1],[2002,373.2],
    [2003,375.8],[2004,377.5],[2005,379.9],[2006,381.9],[2007,383.8],
    [2008,385.6],[2009,387.4],[2010,389.9],[2011,391.6],[2012,393.8],
    [2013,396.5],[2014,398.6],[2015,401.0],[2016,404.2],[2017,406.6],
    [2018,408.5],[2019,411.4],[2020,414.2],[2021,416.4],[2022,418.6],
    [2023,421.1],[2024,422.8],[2025,424.1]
  ];
  maunaLoa.forEach(([y, c]) => data.push({ year: y, co2: c }));

  data.sort((a, b) => a.year - b.year);
  return data;
}

// ── Year formatting ─────────────────────────────────────────────
function formatYear(y) {
  if (y < 0) {
    return `${d3.format(",")(Math.abs(Math.round(y)))} BCE`;
  }
  return `${Math.round(y)} CE`;
}

function formatYearShort(y) {
  if (y <= -1000) {
    const k = Math.abs(Math.round(y / 1000));
    return `${d3.format(",")(k * 1000)} BCE`;
  }
  if (y < 0) return `${Math.abs(Math.round(y))} BCE`;
  return String(Math.round(y));
}

export async function index(host) {
  const doc = host.ownerDocument;
  if (!doc.querySelector(`link[href="${STYLE_URL}"]`)) {
    const link = doc.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE_URL;
    doc.head.appendChild(link);
  }

  host.style.position = "relative";
  host.innerHTML = MARKUP;
  const root = d3.select(host);

  // ─────────────────────────────────────────────────────────────────
  //  CHART
  // ─────────────────────────────────────────────────────────────────
  const allData = generateData();
  const DATA_MIN_YEAR = allData[0].year;               // -803719
  const DATA_MAX_YEAR = allData[allData.length - 1].year; // 2025

  // Slider state (in "year" units)
  let sliderStart = DATA_MIN_YEAR;
  let sliderEnd   = DATA_MAX_YEAR;

  // ── SVG dimensions ──────────────────────────────────────────────
  const margin = { top: 20, right: 70, bottom: 50, left: 72 };
  let totalW = 820;
  let totalH = 460;
  let W = totalW - margin.left - margin.right;
  let H = totalH - margin.top - margin.bottom;

  const svg = root.select("#line-section")
    .append("svg")
    .attr("viewBox", `0 0 ${totalW} ${totalH}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ── Scales ──────────────────────────────────────────────────────
  const xScale = d3.scaleLinear().range([0, W]);
  const yScale = d3.scaleLinear().domain([50, 450]).range([H, 0]).nice();

  // ── Clip path ───────────────────────────────────────────────────
  svg.append("defs").append("clipPath")
    .attr("id", "chart-clip")
    .append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", W).attr("height", H + 2);

  // ── Grid ─────────────────────────────────────────────────────────
  const yGridG = g.append("g").attr("class", "grid y-grid");

  function drawYGrid() {
    yGridG.call(
      d3.axisLeft(yScale)
        .ticks(8)
        .tickSize(-W)
        .tickFormat("")
    );
    yGridG.select(".domain").remove();
    yGridG.selectAll("line")
      .attr("stroke", "#e0e0e0")
      .attr("stroke-dasharray", "3,3");
  }

  // ── Axes ─────────────────────────────────────────────────────────
  const xAxisG = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${H})`);
  const yAxisG = g.append("g").attr("class", "y-axis");

  function drawAxes() {
    const MIN_TICK_PX = 72; // minimum pixel gap between tick labels

    // Generate candidate tick values from scale, then filter for spacing
    const allTicks = xScale.ticks(8);
    const filteredTicks = [];
    let lastPx = -Infinity;
    allTicks.forEach(t => {
      const px = xScale(t);
      if (px - lastPx >= MIN_TICK_PX) {
        filteredTicks.push(t);
        lastPx = px;
      }
    });

    // Always show sliderEnd as the rightmost label
    const endPx = xScale(sliderEnd);
    if (filteredTicks.length > 0) {
      const prevPx = xScale(filteredTicks[filteredTicks.length - 1]);
      if (endPx - prevPx < MIN_TICK_PX) {
        filteredTicks[filteredTicks.length - 1] = sliderEnd; // replace last (e.g. "0") with end year
      } else {
        filteredTicks.push(sliderEnd);
      }
    } else {
      filteredTicks.push(sliderEnd);
    }

    xAxisG.call(
      d3.axisBottom(xScale)
        .tickValues(filteredTicks)
        .tickSize(6)
        .tickFormat(d => formatYearShort(d))
    );
    xAxisG.select(".domain").remove();
    // keep tick lines (the small vertical marks), only remove the axis baseline
    xAxisG.selectAll("text").attr("dy", "1.2em").attr("fill", "#666");
    xAxisG.selectAll(".tick line").attr("stroke", "#bbb");

    // Y axis: ppm labels
    yAxisG.call(
      d3.axisLeft(yScale)
        .ticks(8)
        .tickFormat(d => `${d} ppm`)
    );
    yAxisG.select(".domain").remove();
    yAxisG.selectAll("line").remove();
    yAxisG.selectAll("text")
      .attr("fill", "#666")
      .attr("dx", "-4px");
  }

  // ── Line path ────────────────────────────────────────────────────
  const lineGen = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.co2))
    .curve(d3.curveMonotoneX);

  const linePath = g.append("path")
    .attr("class", "co2-line")
    .attr("clip-path", "url(#chart-clip)");

  // ── Series label ─────────────────────────────────────────────────
  const seriesLabel = g.append("text")
    .attr("class", "series-label")
    .text("World");

  // ── Update chart based on current slider state ────────────────────
  function updateChart() {
    const visData = allData.filter(d => d.year >= sliderStart && d.year <= sliderEnd);

    xScale.domain([sliderStart, sliderEnd]);
    drawYGrid();
    drawAxes();

    linePath.datum(visData).attr("d", lineGen);

    // Position series label near the last visible point
    if (visData.length > 0) {
      const last = visData[visData.length - 1];
      seriesLabel
        .attr("x", xScale(last.year) + 4)
        .attr("y", yScale(last.co2) + 4);
    }
  }

  // ── Tooltip & crosshair ───────────────────────────────────────────
  const tooltip = root
    .append("div")
    .attr("id", "tooltip");

  const crosshairV = g.append("line").attr("class", "crosshair").style("display","none");
  const crosshairDot = g.append("circle")
    .attr("r", 4)
    .attr("fill", "#3c7aad")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2)
    .style("pointer-events","none")
    .style("display","none");

  // Invisible overlay for mouse events
  const overlay = g.append("rect")
    .attr("width", W).attr("height", H)
    .attr("fill", "transparent")
    .attr("cursor", "crosshair");

  const bisect = d3.bisector(d => d.year).left;

  overlay.on("mousemove", function(event) {
    const [mx] = d3.pointer(event);
    const yearHover = xScale.invert(mx);
    const visData = allData.filter(d => d.year >= sliderStart && d.year <= sliderEnd);
    if (!visData.length) return;

    const idx = bisect(visData, yearHover);
    const d0 = visData[Math.max(0, idx - 1)];
    const d1 = visData[Math.min(visData.length - 1, idx)];
    const d = !d1 ? d0 : !d0 ? d1 :
      Math.abs(yearHover - d0.year) < Math.abs(yearHover - d1.year) ? d0 : d1;

    const cx = xScale(d.year);
    const cy = yScale(d.co2);

    crosshairV
      .style("display", null)
      .attr("x1", cx).attr("y1", 0)
      .attr("x2", cx).attr("y2", H);

    crosshairDot.style("display", null).attr("cx", cx).attr("cy", cy);

    const hostRect = host.getBoundingClientRect();
    tooltip
      .style("opacity", 1)
      .html(`<strong>${formatYear(d.year)}</strong>${d.co2.toFixed(1)} ppm`)
      .style("left", (event.clientX - hostRect.left + 14) + "px")
      .style("top",  (event.clientY - hostRect.top - 36) + "px");
  })
  .on("mouseleave", () => {
    crosshairV.style("display", "none");
    crosshairDot.style("display", "none");
    tooltip.style("opacity", 0);
  });

  // ─────────────────────────────────────────────────────────────────
  //  TIME SLIDER (dual-handle range)
  // ─────────────────────────────────────────────────────────────────
  const timeControls = root.select("#time-controls");

  // Play button
  const playBtn = timeControls.append("button")
    .attr("id", "play-btn")
    .attr("title", "Play / Pause")
    .html(`<svg width="10" height="12" viewBox="0 0 10 12"><polygon points="0,0 10,6 0,12" fill="#555"/></svg>`);

  // Start label
  const startLabel = timeControls.append("div").attr("id", "range-start");
  // Slider track wrap
  const trackWrap = timeControls.append("div").attr("id", "slider-track-wrap");
  const track = trackWrap.append("div").attr("id", "slider-track");
  const fill  = track.append("div").attr("id", "slider-fill");
  const handleStart = track.append("div").attr("class", "slider-handle").attr("id", "handle-start");
  const handleEnd   = track.append("div").attr("class", "slider-handle").attr("id", "handle-end");
  // End label
  const endLabel = timeControls.append("div").attr("id", "range-end");

  // Convert year ↔ track percentage
  function yearToPercent(y) {
    return (y - DATA_MIN_YEAR) / (DATA_MAX_YEAR - DATA_MIN_YEAR) * 100;
  }
  function percentToYear(p) {
    return DATA_MIN_YEAR + (p / 100) * (DATA_MAX_YEAR - DATA_MIN_YEAR);
  }

  function updateSliderUI() {
    const pStart = yearToPercent(sliderStart);
    const pEnd   = yearToPercent(sliderEnd);
    handleStart.style("left", pStart + "%");
    handleEnd  .style("left", pEnd   + "%");
    fill.style("left", pStart + "%").style("width", (pEnd - pStart) + "%");
    startLabel.text(formatYearShort(sliderStart));
    endLabel  .text(formatYearShort(sliderEnd));
  }

  // Drag logic
  let dragContext = null;

  function snapYear(yr) {
    if (yr > DATA_MAX_YEAR - 12) return DATA_MAX_YEAR;
    if (yr < DATA_MIN_YEAR + 250) return DATA_MIN_YEAR;
    if (yr >= 1958) return Math.round(yr);
    if (yr >= 1805) return Math.round(yr / 5) * 5;
    return Math.round(yr / 500) * 500;
  }

  // Minimum gap based on data resolution at the given year
  function getMinGap(yr) {
    if (yr >= 1958) return 1;
    if (yr >= 1805) return 5;
    return 500;
  }

  function onSliderMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rect = dragContext.trackEl.getBoundingClientRect();
    let p = Math.max(0, Math.min(100, (clientX - rect.left) / rect.width * 100));
    let yr = snapYear(percentToYear(p));

    if (dragContext.isStart) {
      sliderStart = Math.min(yr, sliderEnd - getMinGap(yr));
    } else {
      sliderEnd = Math.max(yr, sliderStart + getMinGap(yr));
    }
    updateSliderUI();
    updateChart();
  }

  function onSliderUp() {
    doc.removeEventListener("mousemove", onSliderMove);
    doc.removeEventListener("mouseup", onSliderUp);
    doc.removeEventListener("touchmove", onSliderMove);
    doc.removeEventListener("touchend", onSliderUp);
    dragContext = null;
  }

  function makeDraggable(handle, isStart) {
    handle.on("mousedown touchstart", function(event) {
      event.preventDefault();
      dragContext = { trackEl: track.node(), isStart };
      doc.addEventListener("mousemove", onSliderMove);
      doc.addEventListener("mouseup", onSliderUp);
      doc.addEventListener("touchmove", onSliderMove, { passive: false });
      doc.addEventListener("touchend", onSliderUp);
    });
  }

  makeDraggable(handleStart, true);
  makeDraggable(handleEnd,   false);

  // Also allow clicking the track to move nearest handle
  track.on("click", function(event) {
    const rect = this.getBoundingClientRect();
    const p = (event.clientX - rect.left) / rect.width * 100;
    const yr = snapYear(percentToYear(p));
    const dStart = Math.abs(yr - sliderStart);
    const dEnd   = Math.abs(yr - sliderEnd);
    if (dStart <= dEnd) {
      sliderStart = Math.min(yr, sliderEnd - getMinGap(yr));
    } else {
      sliderEnd = Math.max(yr, sliderStart + getMinGap(yr));
    }
    updateSliderUI();
    updateChart();
  });

  // ─────────────────────────────────────────────────────────────────
  //  PLAY ANIMATION
  // ─────────────────────────────────────────────────────────────────
  let playing = false;
  let playTimer = null;
  const PLAY_STEP = 500; // years per tick
  const PLAY_INTERVAL = 40; // ms per tick

  const PLAY_ICON  = `<svg width="10" height="12" viewBox="0 0 10 12"><polygon points="0,0 10,6 0,12" fill="#555"/></svg>`;
  const PAUSE_ICON = `<svg width="10" height="12" viewBox="0 0 10 12"><rect x="0" y="0" width="3.5" height="12" fill="#555"/><rect x="6.5" y="0" width="3.5" height="12" fill="#555"/></svg>`;

  playBtn.on("click", () => {
    playing = !playing;
    playBtn.html(playing ? PAUSE_ICON : PLAY_ICON);

    if (playing) {
      // Reset end to start position — start point = wherever sliderStart is
      sliderEnd = sliderStart;
      updateSliderUI();
      updateChart();

      playTimer = setInterval(() => {
        if (sliderEnd >= DATA_MAX_YEAR) {
          clearInterval(playTimer);
          playing = false;
          playBtn.html(PLAY_ICON);
          return;
        }
        sliderEnd = Math.min(sliderEnd + PLAY_STEP, DATA_MAX_YEAR);
        updateSliderUI();
        updateChart();
      }, PLAY_INTERVAL);
    } else {
      clearInterval(playTimer);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  //  TAB SWITCHING
  // ─────────────────────────────────────────────────────────────────

  // Build table section (hidden by default)
  const tableSection = root.select("#main-content").append("div").attr("id", "table-section");
  const tableEl = tableSection.append("table");
  tableEl.append("thead").append("tr").selectAll("th")
    .data(["Year", "CO₂ (ppm)"])
    .join("th").text(d => d);

  const tbody = tableEl.append("tbody");

  function refreshTable() {
    const vis = allData.filter(d => d.year >= sliderStart && d.year <= sliderEnd);
    // Downsample for display (every ~5000 years)
    const stride = Math.max(1, Math.floor(vis.length / 200));
    const rows = vis.filter((_, i) => i % stride === 0);
    tbody.selectAll("tr").data(rows).join(
      enter => enter.append("tr").call(tr => {
        tr.append("td").text(d => formatYear(d.year));
        tr.append("td").text(d => d.co2.toFixed(1));
      }),
      update => update.call(tr => {
        tr.select("td:nth-child(1)").text(d => formatYear(d.year));
        tr.select("td:nth-child(2)").text(d => d.co2.toFixed(1));
      }),
      exit => exit.remove()
    );
  }

  root.selectAll("button.tabs").on("click", function() {
    const label = this.textContent.trim();
    root.selectAll("button.tabs").classed("active", false);
    d3.select(this).classed("active", true);

    if (label === "Line") {
      root.select("#line-section").style("display", "block");
      root.select("#time-controls").style("display", "flex");
      tableSection.style("display", "none");
    } else {
      root.select("#line-section").style("display", "none");
      root.select("#time-controls").style("display", "none");
      tableSection.style("display", "block");
      refreshTable();
    }
  });

  // Activate Line tab by default
  root.select("button.tabs:last-child").classed("active", true);

  // ─────────────────────────────────────────────────────────────────
  //  INITIAL RENDER
  // ─────────────────────────────────────────────────────────────────
  updateSliderUI();
  updateChart();
}

// Standalone mode: index.html provides an empty <div id="standalone-root">
// and loads this file as <script type="module">. The bundled app never
// creates an element with that id — it calls index(container) itself via
// the d3Adapter — so this never double-mounts inside the React system.
const standaloneRoot = document.getElementById("standalone-root");
if (standaloneRoot) index(standaloneRoot);
