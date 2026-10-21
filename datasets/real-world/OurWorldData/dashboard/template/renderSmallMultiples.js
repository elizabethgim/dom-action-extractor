/*
  Generic "small multiples" grid renderer.

  Used whenever a chart needs one mini chart per facet (e.g. one panel per
  selected country, or one panel per metric/category) — see
  electricity_production_by_source_world (panel = country, stacked area per
  source) and emissions_of_air_pollutants_world_1750_to_2022 (panel = pollutant,
  one line per selected country) for two different uses of this same shape.

  Grid sizing rule: rows = ceil(sqrt(n)), cols = ceil(n / rows) — keeps the
  layout close to square as more panels are added, instead of a fixed column
  count that gets too tall (few columns) or too cramped (too many columns).
*/

function computeGridLayout(n) {
  const rows = Math.ceil(Math.sqrt(n));
  const cols = Math.ceil(n / rows);
  return { rows, cols };
}

/*
  containerSelector: CSS selector for the grid container element. The element
    must have class "charts-grid" (display:grid) and its children get class
    "chart-cell" — see template styles.css.
  panels: array of facet data (one entry per mini chart to draw).
  drawPanel(cell, panelDatum, svgWidth): draws one mini chart into `cell` (a
    d3 selection) at the given pixel width, and returns a "refs" object for
    that panel's independent hover state — typically { vLine, dots, ... } —
    or null/undefined if the panel doesn't need hover tracking.

  Returns the array of refs collected from drawPanel, in panel order — keep
  this around (e.g. in a module-level `let chartRefs = []`) so a shared
  mouseleave/hideHover handler can reset every panel at once.
*/
function renderSmallMultiples(containerSelector, panels, drawPanel) {
  const container = document.querySelector(containerSelector);
  if (!container) return [];
  const sel = d3.select(container);
  sel.html("");
  const chartRefs = [];

  if (!panels.length) return chartRefs;

  const { cols } = computeGridLayout(panels.length);
  sel.style("grid-template-columns", `repeat(${cols}, 1fr)`);

  const containerW = container.getBoundingClientRect().width || 900;
  const cellW = Math.floor(containerW / cols);
  const svgW  = cellW - 32; // subtract .chart-cell's horizontal padding (12+20, see styles.css)

  panels.forEach(panelDatum => {
    const cell = sel.append("div").attr("class", "chart-cell");
    const refs = drawPanel(cell, panelDatum, svgW);
    if (refs) chartRefs.push(refs);
  });

  return chartRefs;
}

/*
  Shared "clear hover on every panel" helper. Pass the chartRefs array
  returned by renderSmallMultiples, plus the shared tooltip element (or
  omit it if the chart doesn't use one). Each ref is expected to expose
  d3 selections under `vLine` and/or `dots` — adjust field names to match
  your panels' refs if they differ.
*/
function hideAllPanelHover(chartRefs, tooltipEl) {
  chartRefs.forEach(r => {
    if (r.vLine) r.vLine.style("display", "none");
    if (r.dots)  r.dots.style("display", "none");
  });
  if (tooltipEl) tooltipEl.classed("hidden", true);
}
