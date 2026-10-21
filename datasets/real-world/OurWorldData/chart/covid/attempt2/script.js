import * as d3 from "d3";
import "./styles.css";

const regions = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia excl. China",
  "China",
  "Oceania"
];

const colors = {
  "North America": "#e07b62",
  "South America": "#8f3e46",
  "Europe": "#5b7db8",
  "Africa": "#b86bb6",
  "Asia excl. China": "#6db59a",
  "China": "#d84d5c",
  "Oceania": "#b96a32"
};

// 국가 -> 지역 매핑
// 실제로는 네 데이터에 맞게 더 많이 채워야 함
const countryToRegion = {
  "Afghanistan": "Asia excl. China",
  "Albania": "Europe",
  "Algeria": "Africa",
  "Argentina": "South America",
  "Australia": "Oceania",
  "Austria": "Europe",
  "Bangladesh": "Asia excl. China",
  "Belgium": "Europe",
  "Brazil": "South America",
  "Canada": "North America",
  "Chile": "South America",
  "China": "China",
  "Colombia": "South America",
  "Denmark": "Europe",
  "Egypt": "Africa",
  "Finland": "Europe",
  "France": "Europe",
  "Germany": "Europe",
  "India": "Asia excl. China",
  "Indonesia": "Asia excl. China",
  "Iran": "Asia excl. China",
  "Iraq": "Asia excl. China",
  "Italy": "Europe",
  "Japan": "Asia excl. China",
  "Kenya": "Africa",
  "Mexico": "North America",
  "Morocco": "Africa",
  "Netherlands": "Europe",
  "New Zealand": "Oceania",
  "Nigeria": "Africa",
  "Norway": "Europe",
  "Pakistan": "Asia excl. China",
  "Peru": "South America",
  "Philippines": "Asia excl. China",
  "Poland": "Europe",
  "Portugal": "Europe",
  "Russia": "Europe",
  "Saudi Arabia": "Asia excl. China",
  "South Africa": "Africa",
  "South Korea": "Asia excl. China",
  "Spain": "Europe",
  "Sweden": "Europe",
  "Switzerland": "Europe",
  "Thailand": "Asia excl. China",
  "Turkey": "Asia excl. China",
  "Ukraine": "Europe",
  "United Kingdom": "Europe",
  "United States": "North America",
  "Uruguay": "South America",
  "Vietnam": "Asia excl. China"
};

const margin = { top: 150, right: 250, bottom: 80, left: 95 };
const chartWidth = 1100;   // 실제 그래프 영역
const legendWidth = 300;   // 오른쪽 legend 공간

const width = chartWidth + legendWidth + margin.left;
// const width = 1450;
const height = 1000;
// const innerWidth = width - margin.left - margin.right;
const innerWidth = chartWidth;
const innerHeight = height - margin.top - margin.bottom;

export function index(container){
  const root = d3.select(container);
  root.selectAll("*").remove();

  const host = root.append("div").attr("class", "covid-chart-host");

  const svg = host
  .append("svg")
  .attr("class", "covid-chart-svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .attr("width", "100%")
  .attr("height", "auto");

  svg
    .append("text")
    .attr("class", "title")
    .attr("x", 28)
    .attr("y", 46)
    .text("Daily confirmed COVID-19 cases by world region");

  svg
    .append("text")
    .attr("class", "subtitle")
    .attr("x", 28)
    .attr("y", 94)
    .text("7-day rolling average. Due to limited testing, the number of confirmed cases is lower than the true number of");

  svg
    .append("text")
    .attr("class", "subtitle")
    .attr("x", 28)
    .attr("y", 128)
    .text("infections.");

  svg
    .append("text")
    .attr("class", "source-note")
    .attr("x", 28)
    .attr("y", height - 18)
    .text("Data source: World Health Organization (2026)");

  svg
    .append("text")
    .attr("class", "credit-note")
    .attr("x", width - 370)
    .attr("y", height - 18)
    .text("OurWorldinData.org/coronavirus | CC BY");

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const tooltip = host
    .append("div")
    .attr("class", "tooltip");

  const csvUrl = new URL("./daily-cases-covid-region.csv", import.meta.url);

  d3.csv(csvUrl).then(rawData => {
    const parseDate = d3.timeParse("%Y-%m-%d");
    const valueColumn ="Daily new confirmed cases due to COVID-19 (rolling 7-day average, right-aligned)";

    console.log(rawData[0]);
    
    // 1. 원본 long format에서 region 정보 붙이기
    const filtered = rawData
      .map(d => {
        const entity = d.Entity?.trim();
        const region = countryToRegion[entity];

        return {
          entity,
          code: d.Code,
          date: parseDate(d.Day),
          value: +d[valueColumn] || 0,
          region
        };
      })
      .filter(d => d.date && d.region);

    // 2. date별, region별 합계 구하기
    // Map(date -> Map(region -> total))
    const grouped = d3.rollup(
      filtered,
      values => d3.sum(values, d => d.value),
      d => +d.date,
      d => d.region
    );

    // 3. stacked area chart용 wide 형태로 변환
    const data = Array.from(grouped, ([dateMs, regionMap]) => {
      const row = {
        date: new Date(+dateMs)
      };

      regions.forEach(region => {
        row[region] = regionMap.get(region) || 0;
      });

      return row;
    }).sort((a, b) => a.date - b.date);

    
    console.log("filtered length:", filtered.length);
    console.log("data length:", data.length);
    console.log("first data row:", data[0]);

    const stack = d3.stack().keys(regions);
    const stacked = stack(data);

    console.log("stacked sample:", stacked[0]?.slice(0, 3));

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, innerWidth]);

    const maxY = d3.max(stacked[stacked.length - 1], d => d[1]);
    console.log("maxY:", maxY);

    const y = d3
      .scaleLinear()
      .domain([0, maxY])
      .nice()
      .range([innerHeight, 0]);

    const xAxis = d3
      .axisBottom(x)
      .ticks(5)
      .tickFormat(d3.timeFormat("%b %-d, %Y"));

    const yAxis = d3
      .axisLeft(y)
      .ticks(7)
      .tickFormat(d => {
        if (d === 0) return "0";
        if (d >= 1000000) return `${d / 1000000} million`;
        if (d >= 1000) return `${d / 1000} thousand`;
        return d;
      });

    const yGrid = d3
      .axisLeft(y)
      .ticks(7)
      .tickSize(-innerWidth)
      .tickFormat("");

    g.append("g").attr("class", "grid").call(yGrid);

    g.append("g")
      .attr("class", "axis y-axis")
      .call(yAxis)
      .call(axis => axis.select(".domain").remove())
      .call(axis => axis.selectAll(".tick line").remove());

    g.append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0, ${innerHeight})`)
      .call(xAxis);

    const area = d3
      .area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveMonotoneX);

    const areaGroups = g
      .append("g")
      .selectAll(".area-layer")
      .data(stacked)
      .join("path")
      .attr("class", "area-layer")
      .attr("fill", d => colors[d.key])
      .attr("opacity", 0.95)
      .attr("d", area);

    const regionLastPoints = stacked.map(series => {
      const last = series[series.length - 1];
      return {
        key: series.key,
        y: (y(last[0]) + y(last[1])) / 2
      };
    });

    const legendX = innerWidth + 12;
    // const legendX = chartWidth + 40;
    const legendYBase = innerHeight - 186;
    const legendSpacing = 31;

    const legend = g.append("g");

    legend
      .selectAll(".legend-connector")
      .data(regionLastPoints)
      .join("path")
      .attr("class", "legend-connector")
      .attr("d", (d, i) => {
        // const startX = innerWidth;
        const startX = chartWidth;
        const startY = d.y;
        const bendX = innerWidth + 24;
        const endX = legendX + 18;
        const endY = legendYBase + i * legendSpacing;
        return `M${startX},${startY} L${bendX},${startY} L${bendX},${endY} L${endX},${endY}`;
      });

    const legendItems = legend
      .selectAll(".legend-item")
      .data(regionLastPoints)
      .join("g")
      .attr("class", "legend-item")
      .attr("transform", (d, i) => `translate(${legendX + 30}, ${legendYBase + i * legendSpacing})`)
      .on("mouseenter", (_, d) => setActiveRegion(d.key))
      .on("mouseleave", clearActiveRegion);

    legendItems
      .append("text")
      .attr("class", "legend-label")
      .attr("fill", d => colors[d.key])
      .text(d => d.key);

    const overlay = g
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "transparent");

    const hoverLine = g
      .append("line")
      .attr("class", "hover-line")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .style("display", "none");

    const points = g
      .append("g")
      .selectAll(".series-point")
      .data(regions)
      .join("circle")
      .attr("class", "series-point")
      .attr("r", 4.5)
      .attr("fill", d => colors[d])
      .style("display", "none");

    const bisectDate = d3.bisector(d => d.date).center;

    overlay
      .on("mousemove", function (event) {
        const [mx] = d3.pointer(event, this);
        const hoveredDate = x.invert(mx);
        const index = bisectDate(data, hoveredDate);
        const row = data[Math.max(0, Math.min(data.length - 1, index))];

        const xPos = x(row.date);

        hoverLine
          .attr("x1", xPos)
          .attr("x2", xPos)
          .style("display", null);

        let cumulative = 0;
        points
          .attr("cx", xPos)
          .attr("cy", region => {
            const y0 = cumulative;
            const y1 = cumulative + row[region];
            cumulative = y1;
            return y((y0 + y1) / 2);
          })
          .style("display", null);

        const [tipX, tipY] = d3.pointer(event, host.node());

        tooltip
          .style("opacity", 1)
          .html(buildTooltipHtml(row))
          .style("left", `${tipX + 18}px`)
          .style("top", `${tipY - 24}px`);
      })
      .on("mouseleave", () => {
        hoverLine.style("display", "none");
        points.style("display", "none");
        tooltip.style("opacity", 0);
      });

    function setActiveRegion(region) {
      areaGroups.attr("opacity", d => (d.key === region ? 1 : 0.18));

      legendItems
        .selectAll(".legend-label")
        .attr("opacity", d => (d.key === region ? 1 : 0.35))
        .style("font-weight", d => (d.key === region ? 700 : 400));
    }

    function clearActiveRegion() {
      areaGroups.attr("opacity", 0.95);

      legendItems
        .selectAll(".legend-label")
        .attr("opacity", 1)
        .style("font-weight", 400);
    }

    function buildTooltipHtml(row) {
      const dateFormat = d3.timeFormat("%b %-d, %Y");
      const numberFormat = d3.format(",");

      const rows = regions
        .slice()
        .reverse()
        .map(region => {
          return `
            <div class="tooltip-row">
              <span class="tooltip-swatch" style="background:${colors[region]}"></span>
              <span class="tooltip-name">${region}</span>
              <span class="tooltip-value">${numberFormat(Math.round(row[region]))}</span>
            </div>
          `;
        })
        .join("");

      return `
        <div class="tooltip-date">${dateFormat(row.date)}</div>
        ${rows}
      `;
    }
  });
}
