function highlightLineEntity(svg, name) {
  svg.selectAll(".entity-line")
    .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
    .attr("stroke-width", function() { return this.getAttribute("data-entity") === name ? 2.5 : 1.5; });
  svg.selectAll(".entity-label")
    .style("opacity", function() { return this.getAttribute("data-entity") === name ? 1 : 0.35; })
    .attr("font-weight", function() { return this.getAttribute("data-entity") === name ? "700" : "400" ; });
}

function clearLineHighlight(svg) {
  svg.selectAll(".entity-line")
    .style("opacity", 1)
    .attr("stroke-width", 2);
  svg.selectAll(".entity-label")
    .style("opacity", 1)
    .attr("font-weight", "400");
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
      .on("mouseenter", () => highlightLineEntity(svg, e.name))
      .on("mouseleave", () => clearLineHighlight(svg));
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
      .on("mouseenter", () => highlightLineEntity(svg, d.name))
      .on("mouseleave", () => clearLineHighlight(svg))
      .text(d.name);
  });

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

  const tipEl   = d3.select("#tooltip");
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

      const lineViewRect = document.getElementById("line-view").getBoundingClientRect();
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
