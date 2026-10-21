/* ── Projection ───────────────────────────────────────────────────────────── */
function makeProjection(width, height) {
  if (state.isZoomed && state.mapSelected.size) {
    const features = state.features.filter(f => state.mapSelected.has(entityForFeature(f)?.name));
    if (features.length) {
      const centroid = d3.geoCentroid({ type: "FeatureCollection", features });
      const proj = d3.geoOrthographic()
        .rotate([-centroid[0], -centroid[1]])
        .translate([width / 2, height / 2]);
      // fit to the actual selected features, then pull back to show globe border
      proj.fitExtent([[60, 40], [width - 60, height - 40]], { type: "FeatureCollection", features });
      proj.scale(proj.scale() * 0.65).translate([width / 2, height / 2]);
      return proj;
    }
  }
  if (state.region && state.region !== "world") {
    const bbox = REGION_BBOX[state.region];
    if (bbox) {
      const [[lon0, lat0], [lon1, lat1]] = bbox;
      return d3.geoNaturalEarth1().fitExtent(
        [[18, 12], [width - 18, height - 34]],
        { type: "Feature", geometry: { type: "MultiPoint", coordinates: [[lon0,lat0],[lon1,lat0],[lon1,lat1],[lon0,lat1]] } }
      );
    }
  }
  return d3.geoNaturalEarth1()
    .fitExtent([[10, 12], [width - 10, height - 34]], { type: "Sphere" });
}

function zoomToSel() {
  if (!state.mapSelected.size) return;
  state.isZoomed = true;
  renderMap(); showMapControls();
}

function resetView() {
  state.isZoomed   = false;
  state.rangeActive = false;
  state.region     = "world";
  els.regionSelect.property("value", "world");
  els.mapPair.classed("range-mode", false);
  syncSliderHandles();
  renderMap(); showMapControls();
}

function showMapControls() {
  const showReset = state.rangeActive || state.isZoomed;
  els.zoomSelBtn.classed("hidden",  state.rangeActive || !state.mapSelected.size || state.isZoomed);
  els.resetViewBtn.classed("hidden", !showReset);
  els.regionSelect.classed("hidden", !state.rangeActive);
  // Only show controls div when on map view
  d3.select("#map-controls").classed("hidden", state.view !== "map");
}


/* ── Map rendering ────────────────────────────────────────────────────────── */
function renderMap() {
  const node   = els.mapSvg.node();
  const width  = node.clientWidth || 1000;
  const height = CONFIG.mapHeight;
  const proj   = makeProjection(width, height);

  if (state.rangeActive) {
    els.mapLeft.attr("viewBox", [0, 0, width, height]);
    renderSingleMap(els.mapLeft, state.startYear, proj, "L");
    addYearLabel(els.mapLeft, state.startYear, width);
  }
  els.mapSvg.attr("viewBox", [0, 0, width, height]);
  renderSingleMap(els.mapSvg, state.endYear, proj, "R");
  if (state.rangeActive) addYearLabel(els.mapSvg, state.endYear, width);
  renderHoverEffects();
}

function renderSingleMap(svg, year, projection, side) {
  const path = d3.geoPath(projection);
  svg.selectAll("*").remove();

  /* Globe sphere + graticule when using orthographic (zoomed) */
  if (state.isZoomed) {
    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("d", path)
      .attr("fill", "#f0f4f8")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5);

    svg.append("path")
      .datum(d3.geoGraticule()())
      .attr("d", path)
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.4);
  }

  const hatchId = `diagonalHatch-${side}`;
  const pat = svg.append("defs").append("pattern")
    .attr("id", hatchId).attr("patternUnits", "userSpaceOnUse")
    .attr("width", 8).attr("height", 8);
  pat.append("rect").attr("width", 8).attr("height", 8).attr("fill", "#fff");
  pat.append("path").attr("d", "M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2")
    .attr("stroke", "#cfcfcf").attr("stroke-width", 1);

  svg.append("g")
    .selectAll("path")
    .data(state.features)
    .join("path")
    .attr("class", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      return `country${v == null ? " no-data" : ""}`;
    })
    .attr("d", path)
    .style("fill", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      const c   = v != null ? colorByValue(v) : null;
      return c || `url(#${hatchId})`;
    })
    .on("mouseenter", (event, d) => {
      const ent = entityForFeature(d);
      if (!ent) return;
      state.hovered = ent.name;
      showTooltip(event, ent, year);
      renderHoverEffects();
    })
    .on("mousemove", event => moveTooltip(event))
    .on("mouseleave", () => {
      state.hovered = null;
      els.tooltip.classed("hidden", true);
      renderHoverEffects();
    })
    .on("click", (_, d) => {
      const ent = entityForFeature(d);
      if (!ent) return;
      state.mapSelected.has(ent.name) ? state.mapSelected.delete(ent.name) : state.mapSelected.add(ent.name);
      renderAll();
    });

  /* Value labels — only for selected countries */
  const labelData = state.features
    .map(f => {
      const ent = entityForFeature(f);
      const v   = ent ? valueAtYear(ent.values, year) : null;
      if (v == null || !state.mapSelected.has(ent?.name)) return null;
      const [cx, cy] = projection(d3.geoCentroid(f));
      if (!isFinite(cx) || !isFinite(cy)) return null;
      return { value: v, cx, cy };
    })
    .filter(Boolean);

  const isDark = v => v >= 30;   // threshold-based: dark fill → white text

  svg.append("g").attr("class", "map-value-labels").attr("pointer-events", "none")
    .selectAll("text")
    .data(labelData)
    .join("text")
    .attr("x", d => d.cx)
    .attr("y", d => d.cy)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", "11px")
    .attr("font-weight", "600")
    .attr("fill", d => isDark(d.value) ? "#fff" : "#333")
    .attr("paint-order", "stroke")
    .attr("stroke", d => isDark(d.value) ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.7)")
    .attr("stroke-width", "2px")
    .text(d => fmtVal(d.value));
}

function addYearLabel(svg, year, width) {
  const g = svg.append("g").style("pointer-events", "none");
  g.append("rect")
    .attr("x", width / 2 - 34).attr("y", 8)
    .attr("width", 68).attr("height", 26).attr("rx", 5)
    .attr("fill", "rgba(255,255,255,0.82)");
  g.append("text")
    .attr("x", width / 2).attr("y", 26)
    .attr("text-anchor", "middle")
    .attr("font-size", 17).attr("font-weight", 700).attr("fill", "#333")
    .text(year);
}


/* ── Hover effects ────────────────────────────────────────────────────────── */
function renderHoverEffects() {
  const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
  svgs.forEach(svg => svg.selectAll(".country")
    .classed("hovered",  d => entityForFeature(d)?.name === state.hovered)
    .classed("selected", d => state.mapSelected.has(entityForFeature(d)?.name))
    .classed("dimmed",   d => !!state.hovered && entityForFeature(d)?.name !== state.hovered));
  d3.selectAll(".country-row")
    .classed("active", d => activeSelection().has(d.name) || state.hovered === d.name);
}


/* ── Legend & bucket highlight ────────────────────────────────────────────── */
function drawLegend() {
  els.legend.html("");

  const noDataItem = els.legend.append("div").style("cursor", "pointer");
  noDataItem.append("div").text("No data");
  noDataItem.append("div").attr("class", "no-data-swatch");
  noDataItem
    .on("mouseenter", () => highlightBucket("nodata"))
    .on("mouseleave", clearBucketHighlight);

  if (CONFIG.colorMode === "threshold") {
    const labels = CONFIG.thresholdLabels || CONFIG.thresholds.map(String);
    const n      = CONFIG.colors.length;
    const cols   = `repeat(${n}, 1fr)`;
    const wrap   = els.legend.append("div");
    wrap.append("div").attr("class", "legend-labels")
      .style("grid-template-columns", cols)
      .selectAll("div").data(CONFIG.colors).join("div")
      .text((_, i) => labels[i] ?? "");
    wrap.append("div").attr("class", "legend-blocks")
      .style("grid-template-columns", cols)
      .selectAll("div").data(CONFIG.colors).join("div")
      .attr("class", "legend-cell").style("background", d => d).style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightBucket(d))
      .on("mouseleave", clearBucketHighlight);

  } else {
    const cats = CONFIG.categories || [];
    const n    = cats.length;
    const cols = `repeat(${n}, 150px)`;
    const wrap = els.legend.append("div");
    wrap.append("div").attr("class", "legend-labels")
      .style("grid-template-columns", cols)
      .selectAll("div").data(cats).join("div").text(d => d.label);
    wrap.append("div").attr("class", "legend-blocks")
      .style("grid-template-columns", cols)
      .selectAll("div").data(cats).join("div")
      .attr("class", "legend-cell").style("background", d => d.color).style("cursor", "pointer")
      .on("mouseenter", (_, d) => highlightBucket(d.value))
      .on("mouseleave", clearBucketHighlight);
  }
}

function highlightBucket(value) {
  const svgs = state.rangeActive ? [els.mapLeft, els.mapSvg] : [els.mapSvg];
  svgs.forEach((svg, i) => {
    const yr = (state.rangeActive && i === 0) ? state.startYear : state.endYear;
    svg.classed("map-dimmed", true);
    svg.selectAll(".country").classed("bucket-highlight", d => {
      const ent = entityForFeature(d);
      const v   = ent ? valueAtYear(ent.values, yr) : null;
      if (value === "nodata") return v == null;
      if (CONFIG.colorMode === "threshold") return v != null && colorByValue(v) === value;
      return v === value;
    });
  });
}

function clearBucketHighlight() {
  [els.mapLeft, els.mapSvg].forEach(svg => {
    svg.classed("map-dimmed", false);
    svg.selectAll(".country").classed("bucket-highlight", false);
  });
}


/* ── Tooltip ─────────────────────────────────────────────────────────────── */
function showTooltip(event, ent, year) {
  const v = valueAtYear(ent.values, year);
  const valText = v == null ? "No data"
    : CONFIG.colorMode === "categorical" ? labelByValue(v)
    : v.toLocaleString();
  els.tooltip.classed("hidden", false)
    .html(`<h3>${ent.name}</h3><div>${year}: <strong>${valText}</strong></div><svg></svg>`);
  drawTinyLine(els.tooltip.select("svg"), ent.values, 260, 110, true, year);
  moveTooltip(event);
}

function moveTooltip(event) {
  const rect = document.getElementById("map-view").getBoundingClientRect();
  els.tooltip
    .style("left", `${event.clientX - rect.left + 16}px`)
    .style("top",  `${event.clientY - rect.top  + 16}px`);
}
