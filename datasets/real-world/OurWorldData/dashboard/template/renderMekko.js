/* ── Marimekko view ───────────────────────────────────────────────────────── */
function renderMekko() {
  const svgNode = document.getElementById("mekko-svg");
  if (!svgNode) return;
  const svg    = d3.select(svgNode);
  const width  = svgNode.clientWidth || 900;
  const year   = state.endYear;

  const legendH = 28;
  const chartH  = 380; // fixed plot height for the bars themselves
  // Reserve enough room below the axis for the deepest possible staggered label
  // row (capped at MAX_LABEL_DEPTH) plus a long rotated name, so labels never
  // overflow past the SVG into the page below.
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

  svg.attr("viewBox", `0 0 ${width} ${height}`)
     .attr("width", "100%")
     .selectAll("*").remove();

  const data = state.entities
    .filter(e => isCountry(e.name))
    .map(e => {
      const ent = state.entityMap.get(e.name);
      return {
        name:      e.name,
        value:     valueAtYear(e.values, year),
        continent: continentOf(ent),
      };
    })
    .filter(d => d.value != null)
    .sort((a, b) => d3.descending(a.value, b.value));  // high → low, left → right

  if (!data.length) {
    svg.append("text").attr("x", margin.left).attr("y", 60)
       .attr("fill", "#666").text("No data for this year");
    return;
  }

  const n    = data.length;
  const barW = iW / n;

  const barColor = d => CONTINENT_COLORS[d.continent] || "#aaa";

  /* ── Region legend — continents with a selected country are bolded/full color;
     the rest are dimmed (only when there is an active selection) ── */
  const activeContinents = new Set(
    [...state.mekkoSelected].map(name => continentOf(state.entityMap.get(name))).filter(Boolean)
  );
  const legendG = svg.append("g").attr("class", "label-country").attr("transform", `translate(${margin.left},8)`);
  const legendItemW = iW / CONTINENT_ORDER.length;
  CONTINENT_ORDER.forEach((cont, i) => {
    const isActive = !state.mekkoSelected.size || activeContinents.has(cont);
    const lg = legendG.append("g").attr("transform", `translate(${i * legendItemW},0)`);
    lg.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2)
      .attr("fill", CONTINENT_COLORS[cont])
      .style("opacity", isActive ? 1 : 0.35);
    lg.append("text")
      .attr("x", 17).attr("y", 10)
      .attr("font-size", 10)
      .attr("font-weight", isActive ? 700 : 400)
      .attr("fill", isActive ? "#222" : "#aaa")
      .text(cont);
    lg.style("cursor", "pointer")
      .on("mouseenter", () => {
        d3.select(svgNode).selectAll(".mekko-bar")
        .style("opacity", dd=>dd.continent == cont ? 1: 0.3);
      })
      .on("mouseleave", () => {
        d3.select(svgNode).selectAll(".mekko-bar")
          .style("opacity", dd => hasSelection && !mekkoSel.has(dd.name) ? 0.3 : 1);
      });
  });

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const y = d3.scaleLinear().domain([0, 1]).range([iH, 0]);

  /* gridlines */
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  g.append("g").selectAll("line")
    .data(yTicks).join("line")
    .attr("x1", 0).attr("x2", iW)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", d => d === 0 ? "#bbb" : "#e5e5e5");

  /* Y axis */
  g.append("g")
    .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format(".1f")).tickSize(0))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick text").attr("x", -8).attr("font-size", 12).attr("fill", "#555"));

  const mekkoSel    = state.mekkoSelected;
  const hasSelection = mekkoSel.size > 0;
  const mekkoTip     = d3.select("#mekko-tooltip");

  /* bars */
  g.selectAll(".mekko-bar")
    .data(data).join("rect")
    .attr("class", "mekko-bar")
    .attr("x", (_, i) => i * barW)
    .attr("y", d => y(d.value))
    .attr("width", Math.max(1, barW - 0.5))
    .attr("height", d => iH - y(d.value))
    .attr("fill",   barColor)
    .attr("stroke", d => mekkoSel.has(d.name) ? barColor(d) : "none")
    .attr("stroke-width", 0.75)
    .style("opacity", d => {
      if (hasSelection) return mekkoSel.has(d.name) ? 1 : 0.3;
      return state.hovered && state.hovered !== d.name ? 0.4 : 1;
    })
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      state.hovered = d.name;
      mekkoTip.classed("hidden", false).html(
        `<h3>${d.name}</h3>
         <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
         <div>${year}: <strong>${d.value.toFixed(3)}</strong></div>`
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
      mekkoSel.has(d.name) ? mekkoSel.delete(d.name) : mekkoSel.add(d.name);
      renderAll();
    });

  /* X-axis labels: sample ~18 evenly spaced indices, but EVERY selected country is
     always included (never dropped for crowding). Sampled slots too close to a
     selected one are dropped instead, since the selected label always wins. */
  const step = Math.max(1, Math.round(n / 18));
  const sampleIdx = new Set();
  for (let i = 0; i < n; i += step) sampleIdx.add(i);

  const selIdx = new Set();
  mekkoSel.forEach(name => {
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

  /* Horizontal collision avoidance: push label anchors apart left→right so none
     overlap (e.g. two adjacent selected bars). A selected label is never dropped —
     it just gets nudged sideways, with an elbow leader line bridging the gap back
     to its actual bar. Required gap is estimated per-label from its text length,
     since longer rotated names need more horizontal clearance than short ones. */
  const MIN_LABEL_GAP = 15;
  const CHAR_W = 10.5; // approx px per character, bold font-size 13, rotated -45
  labelData.forEach(d => {
    d.labelX  = d.naturalX;
    d.gapNeed = Math.max(MIN_LABEL_GAP, d.name.length * CHAR_W * Math.SQRT1_2);
    d.depth = 0;
  });

  if (mekkoSel.size > 0) {
    // nudge - creating an elbow
    for (let k = 1; k < labelData.length; k++) {
      const need = Math.max(labelData[k - 1].gapNeed, labelData[k].gapNeed);
      if (labelData[k].labelX - labelData[k - 1].labelX < need) {
        labelData[k].labelX = labelData[k - 1].labelX + need;
      }
    }
  } else {
    /* Depth staggering: when several bars sit close together (their *actual* x
     positions, not the nudged label positions), step the depth up by one for each
     consecutive close label (0, 1, 2, 3…) instead of just toggling between two
     levels — three or more clustered labels each need their own distinct row,
     not just alternating ones. Depth resets once there's enough clearance again,
     and is capped so labels can never overflow past the reserved bottom margin —
     beyond the cap, extra crowded labels just re-share the deepest row. */
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

  /* leader line: elbow path — down from the bar, sideways to the (possibly nudged)
     label position, then down again to where the rotated label starts */
  const elbowY = iH + 8;
  g.append("g").attr("class", "mekko-label-lines")
    .selectAll("path")
    .data(labelData).join("path")
    .attr("d", d => {
        const textY = iH + labelGap + d.depth * depthStep;
        if (d.naturalX === d.labelX) {
          // straight line
          return `M${d.naturalX},${iH} L${d.labelX},${textY}`;
        }
        // with nudge -> elbow
        const elbowY = textY - 6;
        return `M${d.naturalX},${iH} L${d.naturalX},${elbowY} L${d.labelX},${elbowY} L${d.labelX},${textY}`;
      })
    .attr("fill", "none")
    .attr("stroke", "#aaa")
    .attr("stroke-width", 1);

  g.append("g").attr("class", "mekko-labels")
    .selectAll("text")
    .data(labelData).join("text")
    .attr("transform", d => `translate(${d.labelX},${iH + labelGap + d.depth * depthStep}) rotate(-45)`)
    .attr("text-anchor", "end")
    .attr("dx", "-5px")
    .attr("dy", ".32em")
    .attr("font-size", 13)
    .attr("font-weight", 700)
    .attr("fill", barColor)
    .style("cursor", "pointer")
    .text(d => d.name)
    .on("mouseenter", (event, d) => {
      state.hovered = d.name;
      mekkoTip.classed("hidden", false).html(
        `<h3>${d.name}</h3>
         <div style="color:${barColor(d)};font-weight:600;margin-bottom:4px">${d.continent || ""}</div>
         <div>${year}: <strong>${d.value.toFixed(3)}</strong></div>`
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
      mekkoSel.has(d.name) ? mekkoSel.delete(d.name) : mekkoSel.add(d.name);
      renderAll();
    });
}

function moveMekkoTooltip(event) {
  const rect = document.getElementById("mekko-view").getBoundingClientRect();
  d3.select("#mekko-tooltip")
    .style("left", `${event.clientX - rect.left + 16}px`)
    .style("top",  `${event.clientY - rect.top  - 40}px`);
}
