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
