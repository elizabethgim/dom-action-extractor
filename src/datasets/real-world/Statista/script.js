const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

const width = 1000;
const height = 740;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const margin = { top: 95, right: 40, bottom: 270, left: 110 };

const chartWidth = width - margin.left - margin.right;
const chartHeight = 375;

const chartX = margin.left;
const chartY = margin.top;

const CSV_PATH = "data.csv";

d3.text(CSV_PATH).then(text => {
  const rows = d3.csvParseRows(text);

  const mainHeading = rows[0]?.[0] || "";
  const subHeading = rows[1]?.[0] || "";

  const data = rows.slice(2).map(row => ({
    product: row[0],
    value: +String(row[1]).replace(/,/g, "").replace(/"/g, "")
  }));

  renderChart(data, mainHeading, subHeading);
});

function renderChart(data, mainHeading, subHeading) {
  svg.selectAll("*").remove();

  // 제목
  svg.append("text")
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", 42)
    .text(mainHeading);

  svg.append("text")
    .attr("class", "subtitle")
    .attr("x", width / 2)
    .attr("y", 74)
    .text(subHeading);

  // scales
  const x = d3.scaleBand()
    .domain(data.map(d => d.product))
    .range([chartX, chartX + chartWidth])
    .padding(0.2);

  const yMax = Math.ceil(d3.max(data, d => d.value) / 500) * 500;
  const y = d3.scaleLinear()
    .domain([0, yMax])
    .nice()
    .range([chartY + chartHeight, chartY]);
  
  // background stripes
  svg.append("g")
    .selectAll(".bg-stripe")
    .data(data)
    .join("rect")
    .attr("class", "bg-stripe")
    .attr("x", d => x(d.product))
    .attr("y", chartY)
    .attr("width", x.bandwidth())
    .attr("height", chartHeight)
    .attr("fill", (d, i) => i % 2 === 0 ? "#f7f7f7" : "#efefef");
  
  // overlay
  const overlay = svg.append("rect")
    .attr("x", chartX)
    .attr("y", chartY)
    .attr("width", chartWidth)
    .attr("height", chartHeight)
    .attr("fill", "transparent")
    .style("pointer-events", "all");

  //grid
  const grid = svg.append("g")
  .attr("class", "grid")
  .attr("transform", `translate(${chartX},0)`)
  .call(
    d3.axisLeft(y)
      .tickValues(d3.range(0, yMax + 1, 500))
      .tickSize(-chartWidth)
      .tickFormat("")
  );

  // bars
  const bars = svg.append("g")
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.product))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.value));

  // axes
  svg.append("g")
    .attr("transform", `translate(0,${chartY + chartHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g")
    .attr("transform", `translate(${chartX},0)`)
    .call(d3.axisLeft(y));

  
    
  // interaction
  overlay
    .on("mousemove", function(event) {
      const [mx, my] = d3.pointer(event, svg.node());

      // 가장 가까운 bar 찾기
      let hovered = null;
      let minDist = Infinity;

      data.forEach(d => {
        const cx = x(d.product) + x.bandwidth() / 2;
        const dist = Math.abs(mx - cx);
        if (dist < minDist) {
          minDist = dist;
          hovered = d;
        }
      });

      // highlight
      bars.classed("active", d => d.product === hovered.product);

      // tooltip
      const clampedY = Math.max(chartY, Math.min(chartY + chartHeight, my));

      tooltip
        .style("opacity", 1)
        .html(`
          <div class="tooltip-title">${hovered.product}</div>
          <div class="tooltip-value">${d3.format(",.2f")(hovered.value)} million metric tons</div>
        `)
        .style("left", `${mx + 14}px`)
        .style("top", `${clampedY - 18}px`);
    })
    .on("mouseleave", function() {
      bars.classed("active", false);
      tooltip.style("opacity", 0);
    });

    // Footer
  svg.append("text")
    .attr("class", "footer-label")
    .attr("x", 40)
    .attr("y", 668)
    .text("Source");

  svg.append("text")
    .attr("class", "footer-text")
    .attr("x", 40)
    .attr("y", 685)
    .text("FAO");

  svg.append("text")
    .attr("class", "footer-text")
    .attr("x", 40)
    .attr("y", 702)
    .text("© Statista 2026");

  svg.append("text")
    .attr("class", "footer-label")
    .attr("x", 310)
    .attr("y", 668)
    .text("Additional Information:");

  svg.append("text")
    .attr("class", "footer-text")
    .attr("x", 310)
    .attr("y", 685)
    .text("Worldwide; 2023");

  svg.append("rect")
    .attr("class", "bottom-blue-line")
    .attr("x", 0)
    .attr("y", height - 2)
    .attr("width", width)
    .attr("height", 2);
}