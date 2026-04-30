const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

const WIDTH = 1460;
const HEIGHT = 1000;

svg.attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);

const margin = {
  top: 150,
  right: 240,
  bottom: 95,
  left: 80
};

const innerWidth = WIDTH - margin.left - margin.right;
const innerHeight = HEIGHT - margin.top - margin.bottom;

const CHART_TITLE = "Child mortality rate";
const CHART_SUBTITLE = "Estimated share of newborns who die before age 5.";
const FOOTER_LEFT_STRONG = "Data source:";
const FOOTER_LEFT_TEXT = " Gapminder (2015); UN Inter-agency Group for Child Mortality Estimation (2025)";
const FOOTER_RIGHT_TEXT = "OurWorldinData.org/child-mortality | CC BY";

const DATA_PATH = "data/child-mortality.csv";
const VALUE_KEY = "Under-five mortality rate (selected)";

// Set to null to show every country in the CSV.
// Or put an exact-name array here if you want only specific countries.
const selectedCountries = [
  "Ghana",
  "India",
  "Brazil",
  "United States",
  "United Kingdom",
  "France",
  "South Korea",
  "Sweden"
];

const fixedColorMap = new Map([
  ["Ghana", "#7b4aa8"],
  ["India", "#2f956c"],
  ["Brazil", "#123d78"],
  ["United States", "#9e3b3b"],
  ["United Kingdom", "#a77a2f"],
  ["France", "#c54a0a"],
  ["South Korea", "#b155ab"],
  ["Sweden", "#4b6da9"]
]);

function fallbackColor(name) {
  const palette = d3.schemeTableau10;
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function getColor(name) {
  return fixedColorMap.get(name) || fallbackColor(name);
}

const root = svg.append("g");
const chartG = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const defs = svg.append("defs");
defs.append("clipPath")
  .attr("id", "plot-clip")
  .append("rect")
  .attr("width", innerWidth)
  .attr("height", innerHeight);

root.append("text")
  .attr("class", "title")
  .attr("x", 28)
  .attr("y", 68)
  .text(CHART_TITLE);

root.append("text")
  .attr("class", "subtitle")
  .attr("x", 28)
  .attr("y", 112)
  .text(CHART_SUBTITLE);

const gridG = chartG.append("g");
const yAxisG = chartG.append("g");
const xAxisG = chartG.append("g").attr("transform", `translate(0,${innerHeight})`);
const plotG = chartG.append("g").attr("clip-path", "url(#plot-clip)");
const lineG = plotG.append("g");
const connectorG = chartG.append("g");
const hoverG = chartG.append("g");

chartG.append("line")
  .attr("class", "x-baseline")
  .attr("x1", 0)
  .attr("x2", innerWidth)
  .attr("y1", innerHeight)
  .attr("y2", innerHeight);

const hoverLine = hoverG.append("line")
  .attr("class", "hover-guide")
  .attr("y1", 0)
  .attr("y2", innerHeight)
  .style("display", "none");

const hoverPointsG = hoverG.append("g");

let currentHighlighted = null;
let grouped = [];
let x, y, line;

d3.csv(DATA_PATH, d => ({
  entity: d.Entity,
  code: d.Code,
  year: +d.Year,
  value: +d[VALUE_KEY]
})).then(raw => {
  const filtered = raw
    .filter(d => Number.isFinite(d.year) && Number.isFinite(d.value))
    .filter(d => !selectedCountries || selectedCountries.includes(d.entity));

  grouped = d3.groups(filtered, d => d.entity)
    .map(([entity, values]) => ({
      entity,
      values: values.sort((a, b) => d3.ascending(a.year, b.year))
    }))
    .filter(d => d.values.length > 1);

  const xDomain = d3.extent(filtered, d => d.year);
  const yMax = Math.max(50, d3.max(filtered, d => d.value));

  x = d3.scaleLinear()
    .domain(xDomain)
    .range([0, innerWidth]);

  y = d3.scaleLinear()
    .domain([0, Math.ceil(yMax / 10) * 10])
    .nice()
    .range([innerHeight, 0]);

  const yTicks = [0, 10, 20, 30, 40, 50].filter(t => t <= y.domain()[1]);
  const xTicks = [1751, 1800, 1850, 1900, 1950, 2000, 2023]
    .filter(t => t >= x.domain()[0] && t <= x.domain()[1]);

  const yGrid = d3.axisLeft(y)
    .tickValues(yTicks)
    .tickSize(-innerWidth)
    .tickFormat(d => `${d}%`);

  gridG.attr("class", "grid").call(yGrid);

  const yAxis = d3.axisLeft(y)
    .tickValues(yTicks)
    .tickSize(0)
    .tickPadding(10)
    .tickFormat(d => `${d}%`);

  yAxisG.attr("class", "axis").call(yAxis);

  const xAxis = d3.axisBottom(x)
    .tickValues(xTicks)
    .tickSize(0)
    .tickPadding(12)
    .tickFormat(d3.format("d"));

  xAxisG.attr("class", "axis").call(xAxis);

  line = d3.line()
    .defined(d => Number.isFinite(d.value))
    .x(d => x(d.year))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  lineG.selectAll(".series-line")
    .data(grouped)
    .join("path")
    .attr("class", "series-line")
    .attr("data-entity", d => d.entity)
    .attr("stroke", d => getColor(d.entity))
    .attr("d", d => line(d.values));

  drawLegend();
  drawFooter();
  setupSharedHover();
}).catch(err => {
  console.error(err);

  root.append("text")
    .attr("x", 30)
    .attr("y", 40)
    .attr("fill", "crimson")
    .style("font-family", "sans-serif")
    .style("font-size", "18px")
    .text("Failed to load data. Check DATA_PATH and CSV column names.");
});

function drawLegend() {
  const legendData = grouped
    .map(d => ({
      ...d,
      last: d.values[d.values.length - 1]
    }))
    .sort((a, b) => y(a.last.value) - y(b.last.value));

  const legendX = innerWidth + 54;
  const rowHeight = 31;
  const startY = innerHeight - Math.max(legendData.length * rowHeight + 20, 240);

  const legendG = chartG.append("g").attr("class", "legend");

  connectorG.selectAll(".legend-connector")
    .data(legendData)
    .join("path")
    .attr("class", "legend-connector")
    .attr("data-entity", d => d.entity)
    .attr("stroke", d => getColor(d.entity))
    .attr("d", (d, i) => {
      const x1 = x(d.last.year) + 6;
      const y1 = y(d.last.value);
      const y2 = startY + i * rowHeight;
      const x2 = legendX - 12;
      return `M${x1},${y1} L${x2},${y2} L${legendX},${y2}`;
    });

  const items = legendG.selectAll(".legend-item")
    .data(legendData)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (_, i) => `translate(${legendX},${startY + i * rowHeight})`)
    .on("mouseenter", function(event, d) {
      currentHighlighted = d.entity;
      applyHighlight();
    })
    .on("mouseleave", function() {
      currentHighlighted = null;
      applyHighlight();
    });

  

  items.append("text")
    .attr("x", 10)
    .attr("y", 0)
    .attr("fill", d => getColor(d.entity))
    .text(d => d.entity)
    .each(function() {
      const w = this.getBBox().width;
      d3.select(this.parentNode).select("rect").attr("width", w + 18);
    });
}

function drawFooter() {
  const footerY = HEIGHT - 20;

  const leftGroup = root.append("g")
    .attr("transform", `translate(28,${footerY})`);

  leftGroup.append("text")
    .attr("class", "footer-strong")
    .attr("x", 0)
    .attr("y", 0)
    .text(FOOTER_LEFT_STRONG);

  const strongWidth = leftGroup.select("text").node().getBBox().width;

  leftGroup.append("text")
    .attr("class", "footer")
    .attr("x", strongWidth + 4)
    .attr("y", 0)
    .text(FOOTER_LEFT_TEXT);

  root.append("text")
    .attr("class", "footer")
    .attr("text-anchor", "end")
    .attr("x", WIDTH - 40)
    .attr("y", footerY)
    .text(FOOTER_RIGHT_TEXT);
}

function setupSharedHover() {
  const overlay = chartG.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mouseenter", () => {
      hoverLine.style("display", null);
      tooltip.classed("hidden", false);
    })
    .on("mousemove", onSharedMouseMove)
    .on("mouseleave", () => {
      hoverLine.style("display", "none");
      hoverPointsG.selectAll("*").remove();
      tooltip.classed("hidden", true);
    });
}

function onSharedMouseMove(event) {
  const [mx] = d3.pointer(event, chartG.node());
  const hoveredYear = x.invert(mx);

  const rows = grouped
    .map(series => {
      const bisect = d3.bisector(d => d.year).center;
      const idx = bisect(series.values, hoveredYear);
      const point = series.values[Math.max(0, Math.min(series.values.length - 1, idx))];
      return {
        entity: series.entity,
        year: point.year,
        value: point.value,
        color: getColor(series.entity),
        px: x(point.year),
        py: y(point.value)
      };
    })
    .filter(d => Number.isFinite(d.value));

  if (!rows.length) return;

  const targetYear = rows[0].year;
  const yearRows = rows
    .filter(d => d.year === targetYear)
    .sort((a, b) => d3.descending(a.value, b.value));

  const guideX = x(targetYear);

  hoverLine
    .attr("x1", guideX)
    .attr("x2", guideX)
    .style("display", null);

  const points = hoverPointsG.selectAll(".hover-point")
    .data(yearRows, d => d.entity);

  points.join(
    enter => enter.append("circle")
      .attr("class", "hover-point")
      .attr("r", 4.5)
      .attr("cx", d => d.px)
      .attr("cy", d => d.py)
      .attr("fill", d => d.color),
    update => update
      .attr("cx", d => d.px)
      .attr("cy", d => d.py)
      .attr("fill", d => d.color),
    exit => exit.remove()
  );

  renderSharedTooltip(targetYear, yearRows, guideX);
}

function renderSharedTooltip(year, rows, guideX) {
  const valueFormat = d3.format(".2~f");

  const html = `
    <div class="tooltip-year-shared">${year}</div>
    <div class="tooltip-list">
      ${rows.map(d => `
        <div class="tooltip-row">
          <span class="tooltip-color-box" style="background:${d.color}"></span>
          <span class="tooltip-dot" style="background:${d.color}"></span>
          <span class="tooltip-name">${escapeHtml(d.entity)}</span>
          <span class="tooltip-val">${valueFormat(d.value)}%</span>
        </div>
      `).join("")}
    </div>
  `;

  tooltip.html(html).classed("hidden", false);

  const wrapperRect = document.getElementById("chart-wrapper").getBoundingClientRect();
  const svgRect = svg.node().getBoundingClientRect();
  const tipNode = tooltip.node();

  const tipWidth = tipNode.offsetWidth || 220;
  const tipHeight = tipNode.offsetHeight || 180;

  let left = svgRect.left - wrapperRect.left + margin.left + guideX - tipWidth / 2;
  let top = svgRect.top - wrapperRect.top + margin.top + innerHeight * 0.62;

  left = Math.max(12, Math.min(WIDTH - tipWidth - 12, left));
  top = Math.max(12, Math.min(HEIGHT - tipHeight - 12, top));

  tooltip
    .style("left", `${left}px`)
    .style("top", `${top}px`);
}

function applyHighlight() {
  chartG.selectAll(".series-line")
    .classed("dimmed", d => currentHighlighted && d.entity !== currentHighlighted)
    .classed("active", d => currentHighlighted && d.entity === currentHighlighted);

  chartG.selectAll(".legend-item")
    .classed("dimmed", d => currentHighlighted && d.entity !== currentHighlighted);

  chartG.selectAll(".legend-connector")
    .classed("dimmed", function() {
      return currentHighlighted && this.dataset.entity !== currentHighlighted;
    });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}