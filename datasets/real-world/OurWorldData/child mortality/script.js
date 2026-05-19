import * as d3 from "d3";
import "./styles.css";

const WIDTH = 1460;
const HEIGHT = 1000;

const margin = {
    top: 150,
    right: 210,
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

const csvUrl = new URL("./data/child-mortality.csv", import.meta.url);
const DATA_PATH = "data/child-mortality.csv";
const VALUE_KEY = "Under-five mortality rate (selected)";

// Countries shown in the reference image.
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

const colorMap = new Map([
  ["Ghana", "#7b4aa8"],
  ["India", "#2f956c"],
  ["Brazil", "#123d78"],
  ["United States", "#9e3b3b"],
  ["United Kingdom", "#a77a2f"],
  ["France", "#c54a0a"],
  ["South Korea", "#b155ab"],
  ["Sweden", "#4b6da9"]
]);

export function index(container){
  const root = d3.select(container)
    .classed("child-mortality-chart-host", true)
    .style("position", "relative");
  
  root.selectAll("*").remove();

  const svg = root
    .append("svg")
    .attr("class", "chart")
    .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
    .attr("width", "100%")
    .attr("height", "auto");

  const tooltip = root
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none");

  const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const defs = svg.append("defs");
  defs.append("clipPath")
    .attr("id", "plot-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  svg.append("text")
    .attr("class", "title")
    .attr("x", 28)
    .attr("y", 68)
    .text(CHART_TITLE);

  svg.append("text")
    .attr("class", "subtitle")
    .attr("x", 28)
    .attr("y", 112)
    .text(CHART_SUBTITLE);

  const plotG = chartG.append("g").attr("clip-path", "url(#plot-clip)");
  const gridG = chartG.append("g");
  const yAxisG = chartG.append("g");
  const xAxisG = chartG.append("g").attr("transform", `translate(0,${innerHeight})`);

  chartG.append("line")
    .attr("class", "x-baseline")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", innerHeight)
    .attr("y2", innerHeight);

  const guideLine = chartG.append("line")
    .attr("class", "hover-guide")
    .attr("y1", 0)
    .attr("y2", innerHeight)
    .style("display", "none");

  const hoverPointsG = chartG.append("g");

  let currentActive = null;
  let groupedData = [];
  let xScale;
  let yScale;
  let lineGenerator;

  d3.csv(csvUrl, d => ({
    entity: d.Entity,
    code: d.Code,
    year: +d.Year,
    value: parseFloat(d[VALUE_KEY])
  })).then(raw => {
    const filtered = raw
      .filter(d => selectedCountries.includes(d.entity))
      .filter(d => Number.isFinite(d.year) && Number.isFinite(d.value));

    groupedData = d3.groups(filtered, d => d.entity)
      .map(([entity, values]) => ({
        entity,
        values: values.sort((a, b) => d3.ascending(a.year, b.year))
      }))
      .filter(d => d.values.length > 1);

    const xDomain = d3.extent(filtered, d => d.year);
    const yMax = Math.max(50, d3.max(filtered, d => d.value));

    xScale = d3.scaleLinear()
      .domain(xDomain)
      .range([0, innerWidth]);

    yScale = d3.scaleLinear()
      .domain([0, Math.ceil(yMax / 10) * 10])
      .nice()
      .range([innerHeight, 0]);

    const yTicks = [0, 10, 20, 30, 40, 50].filter(t => t <= yScale.domain()[1]);

    const xTicks = [1751, 1800, 1850, 1900, 1950, 2000, 2023]
      .filter(t => t >= xScale.domain()[0] && t <= xScale.domain()[1]);

    const yGrid = d3.axisLeft(yScale)
      .tickValues(yTicks)
      .tickSize(-innerWidth)
      .tickFormat(d => `${d}%`);

    gridG
      .attr("class", "grid")
      .call(yGrid);

    const yAxis = d3.axisLeft(yScale)
      .tickValues(yTicks)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat(d => `${d}%`);

    yAxisG
      .attr("class", "axis")
      .call(yAxis);

    const xAxis = d3.axisBottom(xScale)
      .tickValues(xTicks)
      .tickSize(0)
      .tickPadding(12)
      .tickFormat(d3.format("d"));

    xAxisG
      .attr("class", "axis")
      .call(xAxis);

    lineGenerator = d3.line()
      .defined(d => Number.isFinite(d.value))
      .x(d => xScale(d.year))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    const seriesG = plotG.append("g");

    const series = seriesG.selectAll(".series")
      .data(groupedData)
      .join("g")
      .attr("class", "series");

    series.append("path")
      .attr("class", "series-line")
      .attr("data-entity", d => d.entity)
      .attr("stroke", d => colorMap.get(d.entity) || "#666")
      .attr("d", d => lineGenerator(d.values));

    drawLegend(groupedData, xScale, yScale);
    drawFooter();
    setupSharedHover();

    function drawLegend(seriesData, x, y) {
      const legendOrder = [
        "Ghana",
        "India",
        "Brazil",
        "United States",
        "United Kingdom",
        "France",
        "South Korea",
        "Sweden"
      ];

      const sorted = legendOrder
        .map(name => seriesData.find(d => d.entity === name))
        .filter(Boolean);

      const legendX = innerWidth + 55;
      const legendY = innerHeight - 235;
      const rowHeight = 31;
      const textPaddingX = 4;

      const legendG = chartG.append("g").attr("class", "legend");

      const items = legendG.selectAll(".legend-item")
        .data(sorted)
        .join("g")
        .attr("class", "legend-item")
        .attr("transform", (_, i) => `translate(${legendX},${legendY + i * rowHeight})`)
        .on("mouseenter", function(event, d) {
          currentActive = d.entity;
          activateSeries(d.entity);
        })
        .on("mouseleave", function() {
          currentActive = null;
          clearHover();
          resetHighlight();
        });

      items.each(function(d, i) {
        const last = d.values[d.values.length - 1];
        const lineEndX = x(last.year);
        const lineEndY = y(last.value);
        const connectorY = legendY + i * rowHeight;

        const connectorPoints = [
          [lineEndX + 6, lineEndY],
          [legendX - 32, connectorY],
          [legendX - 4, connectorY]
        ];

        legendG.append("path")
          .attr("class", "legend-connector")
          .attr("data-entity", d.entity)
          .attr("stroke", colorMap.get(d.entity) || "#666")
          .attr("d", d3.line().curve(d3.curveLinear)(connectorPoints));
      });

      items.append("text")
        .attr("x", textPaddingX)
        .attr("y", 0)
        .attr("fill", d => colorMap.get(d.entity) || "#666")
        .text(d => d.entity);
    }

    function drawFooter() {
      const footerY = HEIGHT - 20;

      const leftGroup = svg.append("g")
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

      svg.append("text")
        .attr("class", "footer")
        .attr("text-anchor", "end")
        .attr("x", WIDTH - 40)
        .attr("y", footerY)
        .text(FOOTER_RIGHT_TEXT);
    }

    function activateSeries(entity) {
      currentActive = entity;

      chartG.selectAll(".series-line")
        .classed("dimmed", d => d.entity !== entity)
        .classed("active", d => d.entity === entity);

      chartG.selectAll(".legend-item")
        .classed("dimmed", d => d.entity !== entity);

      chartG.selectAll(".legend-connector")
        .classed("dimmed", function() {
          return this.dataset.entity !== entity;
        });
    }

    function resetHighlight() {
      chartG.selectAll(".series-line")
        .classed("dimmed", false)
        .classed("active", false);

      chartG.selectAll(".legend-item")
        .classed("dimmed", false);

      chartG.selectAll(".legend-connector")
        .classed("dimmed", false);
    }

    function clearHover() {
      guideLine.style("display", "none");
      hoverPointsG.selectAll("*").remove();
      tooltip.classed("hidden", true);
    }

    function setupSharedHover() {
      chartG.append("rect")
        .attr("class", "shared-hover-overlay")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("mousemove", onSharedHoverMove)
        .on("mouseleave", function() {
          if (currentActive) {
            activateSeries(currentActive);
          } else {
            resetHighlight();
          }
          clearHover();
        });
    }

    function onSharedHoverMove(event) {
      const YEAR_THRESHOLD = 5;
        
      const [mx] = d3.pointer(event, chartG.node());
      const hoveredYear = xScale.invert(mx);

      const rows = groupedData.map(series => {
        const bisect = d3.bisector(d => d.year).center;
        const idx = bisect(series.values, hoveredYear);
        const point = series.values[Math.max(0, Math.min(series.values.length - 1, idx))];

        return {
          entity: series.entity,
          year: point.year,
          value: point.value,
          color: colorMap.get(series.entity) || "#666",
          px: xScale(point.year),
          py: yScale(point.value)
        };
      });

      const visibleRows = rows.filter(d =>
        Math.abs(d.year - hoveredYear) <= YEAR_THRESHOLD &&
        d.px >= 0 &&
        d.px <= innerWidth &&
        d.py >= 0 &&
        d.py <= innerHeight &&
        Number.isFinite(d.value)
      );

      const sortedRows = visibleRows.sort((a, b) => d3.descending(a.value, b.value));

      if (!sortedRows.length) {
        clearHover();
        return;
      }

      guideLine
        .attr("x1", mx)
        .attr("x2", mx)
        .style("display", null);

      const points = hoverPointsG.selectAll(".hover-point")
        .data(sortedRows, d => d.entity);

      points.join(
        enter => enter.append("circle")
          .attr("class", "hover-point")
          .attr("r", 4)
          .attr("cx", d => d.px)
          .attr("cy", d => d.py)
          .attr("fill", d => d.color),
        update => update
          .attr("cx", d => d.px)
          .attr("cy", d => d.py)
          .attr("fill", d => d.color),
        exit => exit.remove()
      );

      showSharedTooltip(Math.round(hoveredYear), sortedRows, mx);
    }

    function showSharedTooltip(year, rows) {
      const valueFormat = d3.format(".2~f");

      tooltip
        .classed("hidden", false)
        .html(`
          <div class="tooltip-year-shared">${year}</div>
          <div class="tooltip-list">
            ${rows.map(d => `
              <div class="tooltip-row">
                <span class="tooltip-color-box" style="background:${d.color}"></span>
                <span class="tooltip-name">${d.entity}</span>
                <span class="tooltip-val">${valueFormat(d.value)}%</span>
              </div>
            `).join("")}
          </div>
        `);

      const wrapperRect = container.getBoundingClientRect();
      const svgEl = svg.node();
      const svgRect = svgEl.getBoundingClientRect();
      const scaleX = svgRect.width / WIDTH;
      const tooltipNode = tooltip.node();
      const tooltipWidth = tooltipNode.offsetWidth || 220;
      const tooltipHeight = tooltipNode.offsetHeight || 120;

      const guideX = xScale(year);
      const scaledGuideX = (margin.left + guideX) * scaleX;
      const scaledTop = (margin.top + 120) * (svgRect.height / HEIGHT);

      let left = svgRect.left - wrapperRect.left + scaledGuideX + 14;
      let top = svgRect.top - wrapperRect.top + scaledTop;

      if (left + tooltipWidth > svgRect.width - 12) {
        left = svgRect.left - wrapperRect.left + scaledGuideX - tooltipWidth - 14;
      }

      if (top + tooltipHeight > svgRect.height - 12) {
        top = svgRect.height - tooltipHeight - 12;
      }

      tooltip
        .style("left", `${left}px`)
        .style("top", `${top}px`);
    }
  }).catch(err => {
    console.error("Failed to load CSV:", err);

    root.append("text")
      .attr("x", 30)
      .attr("y", 40)
      .attr("fill", "crimson")
      .style("font-family", "sans-serif")
      .style("font-size", "18px")
      .text("Failed to load data. Check DATA_PATH and CSV column names.");
  });
}
