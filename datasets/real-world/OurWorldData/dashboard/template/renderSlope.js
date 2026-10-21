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


/* ── Slope chart ──────────────────────────────────────────────────────────── */
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
