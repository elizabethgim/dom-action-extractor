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


/* ── Shared tiny sparkline (used by table rows and the map tooltip) ───────── */
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
