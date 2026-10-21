/*
  OWID-style bubble scatter chart with optional year-range "trails" —
  reusable template, extracted from life_expectancy_vs_gdp_per_capita.

  Shape this expects (adjust field names to your dataset, then find/replace
  throughout this file — they aren't pulled from CONFIG since every chart
  using this pattern tends to have differently-named metrics):
    - X metric:    d.gdp   (log scale)
    - Y metric:    d.le    (linear scale)
    - size metric: d.pop   (sqrt scale, optional — omit the r-scale/legend
                   block entirely if this chart has no size dimension)
    - color/group: d.region, keyed against CONTINENT_COLORS

  Requires in your own script.js:
    - state.entities: [{ name, code, values: [{year, gdp, le, pop, region}, ...] }]
    - state.minYear/maxYear/startYear/endYear/rangeActive/selected/hovered
    - els.scatterSvg, els.scatterTooltip
    - CONFIG.initialSelected → build DEFAULT_LABELED = new Set(...) yourself
    - CONTINENT_COLORS / CONTINENT_ORDER (see colors.js for the OWID palette)
    - a displayName(name) helper (identity function is fine if you don't
      need any abbreviated on-chart labels)
    - renderAll(), renderHoverEffects() driving any side-panel country list

  CSS classes referenced that your styles.css needs to define: .bubble,
  .bubble.hovered/.selected, .bubble-label, .trail-path.trail-hovered, plus
  the tooltip-* classes used by showTrailTooltip's markup (.tooltip-title,
  .tooltip-range, .tooltip-metric, .metric-label, .metric-unit,
  .metric-values, .metric-years, .tooltip-note) — see
  life_expectancy_vs_gdp_per_capita/styles.css for a working set of all of
  these to copy from.

  Range mode ("trails"): when state.rangeActive is true, the big
  size-scaled snapshot bubbles are replaced entirely by a thin line per
  entity walking its (x, y) position across every year in
  [startYear, endYear], plus small per-year dots. Selected entities get
  the full year-by-year dot/label treatment up front; everyone else only
  gets a dot at their first and last point (rendering a dot per entity per
  year for ~190 countries × hundreds of years is what makes this slow —
  see the comment at endpointDots below). Hovering any entity's line — via
  an invisible wide hit-path layered on top of the thin visible one — (a)
  fills in its missing per-year dots/labels, (b) thickens it and caps it
  with an arrowhead, (c) fades every *other* entity's line/dots down to
  near-invisible so the hovered one stands out, (d) dims the legend down
  to just the hovered entity's own group color (via highlightRegion/
  clearRegionHighlight, shared with the legend's own hover), and (e) shows
  a tooltip summarizing the hovered entity's first vs. last value. Clicking
  a trail toggles selection, same as clicking a bubble.
*/

/* ── Indexes ─────────────────────────────────────────────────────────────── */
// A row existing exactly at `year` doesn't mean it's usable — many years
// have one metric but not the other (e.g. GDP every year, life expectancy
// only every 5-10 years in early centuries). Only count a row as a match
// if every required field is present; otherwise fall back to the nearest
// earlier complete row, so a snapshot never silently goes empty just
// because the literal requested year happens to be a gap.
function valueAtYear(values, year) {
  const isComplete = d => d.le != null && d.gdp != null && d.gdp > 0;
  const exact = values.find(d => d.year === year && isComplete(d));
  if (exact) return exact;
  return values.filter(d => d.year <= year && isComplete(d)).at(-1) ?? null;
}

function buildScatterIndexes() {
  const years = [...new Set(state.rows.map(d => d.year))].sort(d3.ascending);

  // The raw CSV may mix in much older single-metric rows (population
  // estimates going back centuries, with no GDP/life-expectancy to match)
  // — those don't count as real chart years.
  const completeYears = years.filter(yr =>
    state.rows.some(d => d.year === yr && d.le != null && d.gdp != null && d.gdp > 0)
  );
  // Earliest year only needs *some* data point — real historical sparseness
  // (one or two countries plotted, growing denser over time) is expected,
  // not a bug, so don't filter it out.
  state.minYear = completeYears.length ? completeYears[0] : d3.min(years);

  // Latest year, by contrast, is capped at the last year with enough rows
  // (≥30 entities) to actually plot — the literal last year in the CSV
  // often only has early estimates for one metric, with the other not yet
  // published for it, which is a publishing-lag artifact rather than real
  // historical sparseness.
  const completeCounts = d3.rollup(
    state.rows.filter(d => d.le != null && d.gdp != null && d.gdp > 0),
    v => v.length,
    d => d.year
  );
  const denseYears = completeYears.filter(yr => (completeCounts.get(yr) || 0) >= 30);
  state.maxYear = denseYears.length ? denseYears.at(-1) : d3.max(years);

  state.startYear = state.maxYear; // collapsed range by default — single-year snapshot
  state.endYear   = state.maxYear;
}

/* ── Scatter chart ───────────────────────────────────────────────────────── */
function renderScatter() {
  const svg    = els.scatterSvg;
  const node   = svg.node();
  const width  = node.clientWidth || 1000;
  const height = 600;
  const margin = { top: 20, right: 170, bottom: 60, left: 70 };
  const w = width  - margin.left - margin.right;
  const h = height - margin.top  - margin.bottom;

  svg.attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").selectAll("*").remove();

  // Arrowhead marker for the hovered trail's leading end — one shared def,
  // recolored to match whichever trail is currently hovered (see
  // trail-hit-area's mouseenter below).
  svg.append("defs").append("marker")
    .attr("id", "trail-arrow")
    .attr("viewBox", "0 0 10 10").attr("refX", 8).attr("refY", 5)
    .attr("markerWidth", 4).attr("markerHeight", 4)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", "#aaa");

  const year = state.endYear;
  const data = state.entities
    .map(e => {
      const row = valueAtYear(e.values, year);
      return row ? { name: e.name, le: row.le, gdp: row.gdp, pop: row.pop, region: row.region } : null;
    })
    .filter(d => d && d.le != null && d.gdp != null && d.gdp > 0);

  if (!data.length) {
    svg.append("text").attr("x", margin.left).attr("y", 60).attr("fill", "#666").text("No data for this year");
    return;
  }

  // Clip everything to the SVG's own bounds — trails for entities whose
  // x/y wanders outside the current axis domain (common over a
  // multi-century range) would otherwise render past the chart entirely,
  // bleeding into whatever sits next to it on the page. Sized to the
  // *full* svg (not just the inner plot rect) so axis tick labels in the
  // margin still show.
  svg.select("defs").append("clipPath").attr("id", "plot-clip")
    .append("rect")
    .attr("x", -margin.left).attr("y", -margin.top)
    .attr("width", width).attr("height", height);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .attr("clip-path", "url(#plot-clip)");

  // In range mode the axes need to fit every year's value along every
  // trail, not just the endYear snapshot — otherwise the domain stays
  // locked to wherever the chart ends up, and early-year trail points
  // (often a very different value range) draw far outside it.
  let domainGdp = data.map(d => d.gdp);
  let domainLe  = data.map(d => d.le);
  if (state.rangeActive) {
    state.entities.forEach(e => {
      e.values.forEach(v => {
        if (v.year >= state.startYear && v.year <= state.endYear &&
            v.gdp != null && v.gdp > 0 && v.le != null) {
          domainGdp.push(v.gdp);
          domainLe.push(v.le);
        }
      });
    });
  }

  const x = d3.scaleLog()
    .domain([d3.min(domainGdp) * 0.8, d3.max(domainGdp) * 1.2])
    .range([0, w]);

  const y = d3.scaleLinear()
    .domain([d3.min(domainLe) - 5, d3.max(domainLe) + 5])
    .range([h, 0]).nice();

  const maxPop = d3.max(data, d => d.pop) || 1;
  const r = d3.scaleSqrt().domain([0, maxPop]).range([2, 42]);

  const colorOf = d => CONTINENT_COLORS[d.region] || "#aaa";

  // With an active selection, unselected bubbles/trails grey out and selected
  // ones keep their continent color — driven by selection, not hover, so it
  // stays put after the mouse moves away.
  const hasSelection = state.selected.size > 0;
  const rangeActive = state.rangeActive;

  // Shared "highlight one group" effect, used by both the legend's own
  // hover and hovering a trail line — defined as empty no-ops here and
  // filled in once the legend itself exists further down (closures over
  // `legendG` etc.), but callable from the trail-hover handler immediately
  // since hover events only ever fire after this whole function returns.
  let highlightRegion = () => {};
  let clearRegionHighlight = () => {};

  // Prefer the standard nice round-number ticks ($500, $1,000, ...) — but
  // a log scale's default .ticks() returns every 1-9× multiple per decade,
  // which is fine across a wide domain (one or two of those land per
  // decade) but floods a narrow domain (all 9 multiples land in the same
  // decade, e.g. $600/$700/$800/$900 all packed between $500 and $1,000).
  // So: use the round-number set when it gives a reasonable count, and
  // only fall back to the domain-adaptive ticks when the domain is too
  // narrow for any of those round numbers to apply.
  const niceTicks = [200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]
    .filter(v => v >= x.domain()[0] && v <= x.domain()[1]);
  const xTicks = niceTicks.length >= 3 ? niceTicks : x.ticks(9);

  /* gridlines — horizontal (Y ticks) and vertical (X ticks) */
  const yTicks = y.ticks(7);
  g.append("g").selectAll("line.grid-y")
    .data(yTicks).join("line")
    .attr("class", "grid-y")
    .attr("x1", 0).attr("x2", w)
    .attr("y1", d => y(d)).attr("y2", d => y(d))
    .attr("stroke", "#dedede").attr("stroke-dasharray", "5,3");

  g.append("g").selectAll("line.grid-x")
    .data(xTicks).join("line")
    .attr("class", "grid-x")
    .attr("y1", 0).attr("y2", h)
    .attr("x1", d => x(d)).attr("x2", d => x(d))
    .attr("stroke", "#dedede").attr("stroke-dasharray", "5,3");

  /* X axis: log scale, $ formatted */
  g.append("g")
    .attr("transform", `translate(0,${h})`)
    .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(d => `$${d3.format(",")(d)}`).tickSizeOuter(0))
    .call(ax => ax.select(".domain").attr("stroke", "#ccc"))
    .call(ax => ax.selectAll(".tick line").attr("stroke", "#ccc"))
    .call(ax => ax.selectAll(".tick text").style("font-size", "12px").style("fill", "#666"));

  g.append("text")
    .attr("x", w / 2).attr("y", h + 46)
    .attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#555")
    .text("GDP per capita (international-$; plotted on a logarithmic axis)");

  /* Y axis */
  g.append("g")
    .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d => `${d3.format("d")(d)} years`).tickSize(0))
    .call(ax => ax.select(".domain").remove())
    .call(ax => ax.selectAll(".tick text").attr("x", -8).style("font-size", "12px").style("fill", "#666"));

  g.append("text")
    .attr("x", 0).attr("y", -8)
    .style("font-size", "13px").style("fill", "#333")
    .text("Life expectancy at birth");

  /* trails: one path per entity, walking its (x, y) position year by year
     across [startYear, endYear]. In range mode this *replaces* the big
     size-scaled bubbles entirely — every entity gets a line plus a small
     dot-and-year-label at each year along it, instead of one big
     snapshot circle. */
  let trails = [];
  if (rangeActive) {
    // No .defined() here on purpose: pts is pre-filtered to only valid
    // points, so the line connects straight across any gap years (e.g. a
    // country with only decade-spaced early estimates) instead of breaking
    // into disconnected dots at every gap.
    const trailLine = d3.line()
      .x(d => x(d.gdp))
      .y(d => y(d.le))
      .curve(d3.curveCatmullRom);

    trails = state.entities.map(e => ({
      name: e.name,
      region: e.values.find(v => v.region)?.region,
      pts: e.values.filter(v =>
        v.year >= state.startYear && v.year <= state.endYear &&
        v.gdp != null && v.gdp > 0 && v.le != null
      ),
    })).filter(t => t.pts.length > 1);

    // Shared styling for a year-number label next to a trail point — used
    // both for the persistent labels on a selected trail and the labels
    // shown while hovering any trail.
    function styleTrailYearLabels(sel, color) {
      return sel
        .attr("x", p => x(p.gdp)).attr("y", p => y(p.le) - 8)
        .attr("text-anchor", "middle")
        .style("font-size", "10px").style("fill", color)
        .attr("paint-order", "stroke").attr("stroke", "#fff").attr("stroke-width", 2.5)
        .text(p => p.year);
    }

    // Decluttering: only keep a point if it's far enough (in pixels) from
    // the last kept point along the trail — long trails (decades of yearly
    // points) would otherwise overlap into an unreadable smear of numbers.
    function declutterTrailPoints(pts) {
      const kept = [];
      let lastX = -Infinity, lastY = -Infinity;
      pts.forEach(p => {
        const px = x(p.gdp), py = y(p.le);
        if (Math.hypot(px - lastX, py - lastY) > 28) {
          kept.push(p);
          lastX = px; lastY = py;
        }
      });
      return kept;
    }

    const trailPaths = g.append("g").attr("class", "trails")
      .selectAll("path")
      .data(trails, d => d.name)
      .join("path")
      .attr("class", "trail-path")
      .attr("data-name", d => d.name)
      .attr("d", d => trailLine(d.pts))
      .attr("fill", "none")
      .attr("stroke", d => hasSelection && !state.selected.has(d.name) ? "#d8d8d8" : (CONTINENT_COLORS[d.region] || "#aaa"))
      .attr("stroke-width", d => state.selected.has(d.name) ? 2 : 1)
      .style("opacity", d => state.selected.has(d.name) ? 0.9 : (hasSelection ? 0.25 : 0.55))
      .style("pointer-events", "none");

    const hoverDotsG   = g.append("g").attr("class", "trail-hover-dots").style("pointer-events", "none");
    const hoverLabelsG = g.append("g").attr("class", "trail-hover-labels").style("pointer-events", "none");

    // Invisible wide hit-path on top of each (thin) visible trail, just to
    // make hovering the line itself easy. On hover: shows the rich tooltip,
    // thickens that trail and caps it with an arrowhead, fades every other
    // trail/dot down to near-invisible, dims the legend to just this
    // entity's group, and fills in this trail's missing per-year dots/labels.
    g.append("g").attr("class", "trail-hit-areas")
      .selectAll("path")
      .data(trails, d => d.name)
      .join("path")
      .attr("d", d => trailLine(d.pts))
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 10)
      .style("cursor", "pointer")
      .on("mouseenter", (event, t) => {
        state.hovered = t.name;
        showTrailTooltip(event, t);
        renderHoverEffects();
        const color = CONTINENT_COLORS[t.region] || "#aaa";
        svg.select("#trail-arrow path").attr("fill", color);
        // Highlight the whole group in the legend first, then narrow the
        // trail/dot opacity down to just this one entity — order matters,
        // since highlightRegion also sets per-group trail opacity that
        // this needs to override.
        highlightRegion(t.region);
        trailPaths.classed("trail-hovered", d => d.name === t.name)
          .attr("marker-end", d => d.name === t.name ? "url(#trail-arrow)" : null)
          .style("opacity", d => d.name === t.name ? 1 : 0.08);
        g.selectAll(".trail-years circle").style("opacity", d => d.name === t.name ? 1 : 0.08);
        const pts = t.pts; // already valid-only, see trails building above
        hoverDotsG.selectAll("circle")
          .data(pts, p => p.year).join("circle")
          .attr("cx", p => x(p.gdp)).attr("cy", p => y(p.le))
          .attr("r", 3).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 1);
        styleTrailYearLabels(
          hoverLabelsG.selectAll("text").data(declutterTrailPoints(pts), p => p.year).join("text"), color
        );
      })
      .on("mousemove", moveScatterTooltip)
      .on("mouseleave", () => {
        state.hovered = null;
        els.scatterTooltip.classed("hidden", true);
        renderHoverEffects();
        clearRegionHighlight();
        trailPaths.classed("trail-hovered", false).attr("marker-end", null)
          .style("opacity", d => state.selected.has(d.name) ? 0.9 : (hasSelection ? 0.25 : 0.55));
        // endpointDots circles carry a synthetic `.color` field the
        // per-year selected-trail circles don't, so this tells the two
        // groups (different default opacities) apart without re-render.
        g.selectAll(".trail-years circle").style("opacity", d => d.color !== undefined ? 0.5 : 1);
        hoverDotsG.selectAll("circle").remove();
        hoverLabelsG.selectAll("text").remove();
      })
      // Clicking a trail selects that entity, same toggle as clicking a
      // bubble — picks up the persistent "selected" trail styling (bolder
      // line, decluttered year labels, name label) on the next render.
      .on("click", (_, t) => {
        state.selected.has(t.name) ? state.selected.delete(t.name) : state.selected.add(t.name);
        renderAll();
      });

    // Rendering a dot for every year of every trail (up to ~190 entities ×
    // hundreds of years) is what makes range mode slow to render. Instead,
    // unselected trails only get their start and end point dotted by
    // default — every-year dots for a given trail are added on demand by
    // the hover handler above instead. Selected entities are few enough
    // that showing their full year-by-year dots and labels up front is fine.
    const endpointDots = trails.flatMap(t => {
      if (state.selected.has(t.name)) return [];
      const color = hasSelection ? "#d8d8d8" : (CONTINENT_COLORS[t.region] || "#aaa");
      const first = t.pts[0], last = t.pts[t.pts.length - 1];
      return first === last
        ? [{ ...first, name: t.name, color }]
        : [{ ...first, name: t.name, color }, { ...last, name: t.name, color }];
    });
    g.append("g").attr("class", "trail-years").style("pointer-events", "none")
      .selectAll("circle")
      .data(endpointDots)
      .join("circle")
      .attr("cx", p => x(p.gdp)).attr("cy", p => y(p.le))
      .attr("r", 2)
      .attr("fill", p => p.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.75)
      .style("opacity", 0.5);

    trails.filter(t => state.selected.has(t.name)).forEach(t => {
      const pts  = t.pts; // already valid-only, see trails building above
      const color = CONTINENT_COLORS[t.region] || "#aaa";

      g.append("g").attr("class", "trail-years").style("pointer-events", "none")
        .selectAll("circle")
        .data(pts.map(p => ({ ...p, name: t.name })), p => p.year).join("circle")
        .attr("cx", p => x(p.gdp)).attr("cy", p => y(p.le))
        .attr("r", 3)
        .attr("fill", color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

      const labelPts = declutterTrailPoints(pts);

      styleTrailYearLabels(
        g.append("g").attr("class", "trail-year-labels").style("pointer-events", "none")
          .selectAll("text")
          .data(labelPts, p => p.year).join("text"),
        color
      );
    });
  }

  /* bubbles, sorted so larger ones draw first (smaller on top, easier to hover) */
  const sorted = data.slice().sort((a, b) => d3.descending(a.pop, b.pop));

  // Shared hover/click behavior for both a bubble and its label — hovering
  // either one highlights the same underlying entity the same way.
  function onPointEnter(event, d) {
    state.hovered = d.name;
    showScatterTooltip(event, d, year);
    renderHoverEffects();
  }
  function onPointMove(event) { moveScatterTooltip(event); }
  function onPointLeave() {
    state.hovered = null;
    els.scatterTooltip.classed("hidden", true);
    renderHoverEffects();
  }
  function onPointClick(_, d) {
    state.selected.has(d.name) ? state.selected.delete(d.name) : state.selected.add(d.name);
    renderAll();
  }

  // In range mode there's no snapshot bubble to hover/click — the trail's
  // own per-year dots stand in for it, so this joins an empty array (just
  // clears out any bubbles left over from a previous single-year render).
  const bubbles = g.selectAll(".bubble")
    .data(rangeActive ? [] : sorted, d => d.name).join("circle")
    .attr("class", "bubble")
    .classed("selected", d => state.selected.has(d.name))
    .attr("cx", d => x(d.gdp))
    .attr("cy", d => y(d.le))
    .attr("r", d => r(d.pop || 0))
    .attr("fill", d => hasSelection && !state.selected.has(d.name) ? "#d8d8d8" : colorOf(d))
    .attr("stroke", d => state.selected.has(d.name) ? colorOf(d) : "none")
    .attr("stroke-width", d => state.selected.has(d.name) ? 1.5 : 0)
    .style("opacity", d => hasSelection && !state.selected.has(d.name) ? 0.6 : 0.85)
    .on("mouseenter", onPointEnter)
    .on("mousemove", onPointMove)
    .on("mouseleave", onPointLeave)
    .on("click", onPointClick);

  /* selection marker: a ring drawn just outside the bubble's own edge,
     scaling with its size-scaled radius rather than a fixed size — it
     reads as a halo wrapping the bubble, not a separate icon at its
     center. Not needed in range mode — the trail dots are already
     bolded instead. */
  const selectedData = rangeActive ? [] : sorted.filter(d => state.selected.has(d.name));
  const markersG = g.append("g").attr("class", "selection-markers").style("pointer-events", "none");
  markersG.selectAll(".selection-ring")
    .data(selectedData, d => d.name).join("circle")
    .attr("class", "selection-ring")
    .attr("cx", d => x(d.gdp)).attr("cy", d => y(d.le))
    .attr("r", d => r(d.pop || 0) + 3).attr("fill", "none")
    .attr("stroke", d => colorOf(d)).attr("stroke-width", 1.5);

  /* labels for selected entities, simple offset placement. Styling is
     shared with the legend's "show this group's labels" hover feature
     below, so both draw identical-looking text. In range mode there's no
     bubble to offset around, so the offset is a small fixed amount instead
     of growing with the (now-absent) size radius. */
  function styleLabel(sel) {
    return sel
      .attr("x", d => x(d.gdp) + (rangeActive ? 6 : r(d.pop || 0) + 4))
      .attr("y", d => y(d.le) - (rangeActive ? 6 : r(d.pop || 0) + 2))
      .style("font-size", "12px")
      .style("font-weight", 600)
      .style("fill", d => colorOf(d))
      // White halo behind the glyphs so labels stay readable over bubbles
      // and other text, instead of only working on plain white background.
      .attr("paint-order", "stroke")
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .style("stroke-linejoin", "round")
      .text(d => displayName(d.name))
      // Hover only — no click-to-select on in-chart labels. Selecting by
      // group is the legend's job; selecting one entity is the bubble's
      // job (clicking the label itself does neither).
      .on("mouseenter", onPointEnter)
      .on("mousemove", onPointMove)
      .on("mouseleave", onPointLeave);
  }

  const labelsG = g.append("g").attr("class", "bubble-labels");

  // Default-labeled entities only show while nothing is selected; once the
  // user picks something, labels switch to showing just the selection.
  const labelData = sorted.filter(d => hasSelection ? state.selected.has(d.name) : DEFAULT_LABELED.has(d.name));
  const labelDataNames = new Set(labelData.map(d => d.name));
  styleLabel(
    labelsG.selectAll("text.bubble-label")
      .data(labelData, d => d.name).join("text")
      .attr("class", "bubble-label")
  );

  /* group legend, top right — always shows each group's true color;
     hovering an item (or hovering a trail, via highlightRegion above)
     highlights that group's bubbles/swatch on the chart, and clicking it
     selects every entity in that group. */
  const legendG = svg.append("g").attr("transform", `translate(${width - margin.right + 20},${margin.top + 8})`);
  const legendRects = [], legendTexts = [];

  highlightRegion = cont => {
    bubbles.style("opacity", d => d.region === cont ? 0.9 : 0.15);
    if (rangeActive) {
      g.selectAll(".trails path").style("opacity", d => d.region === cont ? 0.7 : 0.1);
    }
    // Grey out whichever labels are already showing but belong to a
    // different group, then add a label for every entity in this one —
    // not just the default/selected ones.
    labelsG.selectAll("text.bubble-label").style("fill", d => d.region === cont ? colorOf(d) : "#ccc");
    styleLabel(
      labelsG.selectAll("text.hover-region-label")
        .data(data.filter(d => d.region === cont && !labelDataNames.has(d.name)), d => d.name).join("text")
        .attr("class", "hover-region-label")
    );
    legendRects.forEach(({ cont: c, sel }) => sel.attr("fill", c === cont ? CONTINENT_COLORS[c] : "#ddd"));
    legendTexts.forEach(({ cont: c, sel }) => sel.style("fill", c === cont ? CONTINENT_COLORS[c] : "#bbb"));
  };
  clearRegionHighlight = () => {
    bubbles.style("opacity", d => hasSelection && !state.selected.has(d.name) ? 0.6 : 0.85);
    if (rangeActive) {
      g.selectAll(".trails path").style("opacity", d =>
        hasSelection && !state.selected.has(d.name) ? 0.35 : 0.55);
    }
    labelsG.selectAll("text.bubble-label").style("fill", d => colorOf(d));
    labelsG.selectAll("text.hover-region-label").remove();
    legendRects.forEach(({ cont: c, sel }) => sel.attr("fill", CONTINENT_COLORS[c]));
    legendTexts.forEach(({ cont: c, sel }) => sel.style("fill", CONTINENT_COLORS[c]));
  };

  CONTINENT_ORDER.forEach((cont, i) => {
    const lg = legendG.append("g").attr("transform", `translate(0,${i * 20})`)
      .style("cursor", "pointer")
      .on("mouseenter", () => highlightRegion(cont))
      .on("mouseleave", clearRegionHighlight)
      .on("click", () => {
        // Persist the hover preview as an actual selection: every entity
        // in this group, added to whatever was already selected.
        data.filter(d => d.region === cont).forEach(d => state.selected.add(d.name));
        renderAll();
      });
    const rectSel = lg.append("rect").attr("width", 11).attr("height", 11).attr("rx", 2)
      .attr("fill", CONTINENT_COLORS[cont]);
    const textSel = lg.append("text").attr("x", 16).attr("y", 9)
      .style("font-size", "12px").style("fill", CONTINENT_COLORS[cont])
      .style("font-weight", 600)
      .text(cont);
    legendRects.push({ cont, sel: rectSel });
    legendTexts.push({ cont, sel: textSel });
  });

  /* size legend — placed clear of the group legend above, leaving room
     for the size circle's own height (up to 2 * its radius). A divider
     line separates it from the group legend. Skip this whole block if
     your chart has no size dimension. */
  const regionLegendBottom = margin.top + 8 + CONTINENT_ORDER.length * 20;
  const bigPop = maxPop, smallPop = Math.min(600e6, maxPop * 0.4);
  const bigR = r(bigPop), smallR = r(smallPop);

  const dividerY = regionLegendBottom + 14;
  svg.append("line")
    .attr("x1", width - margin.right + 20).attr("x2", width - 10)
    .attr("y1", dividerY).attr("y2", dividerY)
    .attr("stroke", "#ddd");

  const sizeLegendY = dividerY + bigR * 2 + 36;
  const sizeLegendG = svg.append("g").attr("transform", `translate(${width - margin.right + 50},${sizeLegendY})`);
  // Both circles share the same bottom edge (cy = -radius puts the bottom at y=0).
  sizeLegendG.append("circle").attr("r", bigR).attr("cy", -bigR).attr("fill", "none").attr("stroke", "#999");
  sizeLegendG.append("circle").attr("r", smallR).attr("cy", -smallR).attr("fill", "none").attr("stroke", "#999");
  // Each value label sits just above its own circle's top.
  sizeLegendG.append("text").attr("y", -bigR * 2 - 6).attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#666")
    .text(fmtShortNumber(bigPop));
  sizeLegendG.append("text").attr("y", -smallR * 2 - 6).attr("text-anchor", "middle").style("font-size", "12px").style("fill", "#666")
    .text(fmtShortNumber(smallPop));
  sizeLegendG.append("text").attr("y", 24).attr("text-anchor", "middle").style("font-size", "11px").style("fill", "#666")
    .text("Circles sized by");
  sizeLegendG.append("text").attr("y", 38).attr("text-anchor", "middle").style("font-weight", 600).style("font-size", "11px").style("fill", "#666")
    .text("Population");

  renderHoverEffects();
}

// d3.format's SI prefixes use "G" for billion; OWID-style legends use "B".
function fmtShortNumber(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return `${v}`;
}

function showScatterTooltip(event, d, year) {
  els.scatterTooltip.classed("hidden", false).html(
    `<h3>${d.name}</h3>
     <div>${year}</div>
     <div style="margin-top:6px">Life expectancy: <strong>${d.le.toFixed(1)} years</strong></div>
     <div>GDP per capita: <strong>$${d3.format(",.0f")(d.gdp)}</strong></div>
     ${d.pop ? `<div>Population: <strong>${d3.format(",.0f")(d.pop)}</strong></div>` : ""}`
  );
  moveScatterTooltip(event);
}

// Trail (range-mode line) tooltip: summarizes the whole hovered trail by
// its first vs. last available data point, instead of one year's snapshot.
function showTrailTooltip(event, t) {
  const pts = t.pts; // already valid-only, see trails building in renderScatter()
  if (!pts.length) return;
  const first = pts[0], last = pts[pts.length - 1];
  const arrow = (a, b) => b > a ? "↗" : (b < a ? "↘" : "→");
  const yearSpan = first.year === last.year ? `${first.year}` : `${first.year}–${last.year}`;

  const metricRow = (label, unit, a, b, fmt) => `
    <div class="tooltip-metric">
      <div class="metric-label">${label}${unit ? ` <span class="metric-unit">${unit}</span>` : ""}</div>
      <div class="metric-values">
        <strong>${fmt(a)}</strong> ${arrow(a, b)} <strong>${fmt(b)}</strong>
        <span class="metric-years">${yearSpan}</span>
      </div>
    </div>`;

  const note = first.year !== state.startYear
    ? `<div class="tooltip-note">Data not available for ${state.startYear} to ${first.year}. Showing closest available data point instead.</div>`
    : "";

  els.scatterTooltip.classed("hidden", false).html(`
    <div class="tooltip-title">${displayName(t.name)}</div>
    <div class="tooltip-range">${state.startYear} to ${state.endYear}</div>
    ${metricRow("GDP per capita", "(international-$ in 2011 prices)", first.gdp, last.gdp, v => `$${d3.format(",.0f")(v)}`)}
    ${metricRow("Life expectancy at birth", "", first.le, last.le, v => `${v.toFixed(1)} years`)}
    ${first.pop != null && last.pop != null
      ? metricRow("Population", "(people)", first.pop, last.pop, v => d3.format(",.2f")(v / 1e6) + " million")
      : ""}
    ${note}
  `);
  moveScatterTooltip(event);
}

function moveScatterTooltip(event) {
  const rect = document.getElementById("scatter-view").getBoundingClientRect();
  els.scatterTooltip
    .style("left", `${event.clientX - rect.left + 16}px`)
    .style("top",  `${event.clientY - rect.top  + 16}px`);
}
