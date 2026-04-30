const svg = d3.select("#chart");
const tooltip = d3.select("#tooltip");

const width = 1000;
const height = 740;

svg.attr("viewBox", `0 0 ${width} ${height}`);

const margin = {
  top: 95,
  right: 40,
  bottom: 270,
  left: 110
};

const chartWidth = width - margin.left - margin.right;
const chartHeight = 375;

const chartX = margin.left;
const chartY = margin.top;

const CSV_PATH = "data.csv";

d3.text(CSV_PATH).then(text => {
  const rows = d3.csvParseRows(text);

  const mainHeading = rows[0]?.[0] || "";
  const subHeading = rows[1]?.[0] || "";

  const data = rows
    .slice(2)
    .map(row => ({
      product: row[0],
      value: +String(row[1]).replace(/,/g, "").replace(/"/g, "")
    }))
    .filter(d => d.product && !isNaN(d.value));

  renderChart(data, mainHeading, subHeading);
}).catch(error => {
  console.error("CSV load error:", error);
});

function renderChart(data, mainHeading) {
  svg.selectAll("*").remove();

  // Title
  svg.append("text")
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", 42)
    .text(mainHeading);


  const x = d3.scaleBand()
    .domain(data.map(d => d.product))
    .range([chartX, chartX + chartWidth])
    .paddingInner(0.28)
    .paddingOuter(0.12);

  const maxValue = d3.max(data, d => d.value);
  const yMax = Math.ceil(maxValue / 500) * 500;

  const y = d3.scaleLinear()
    .domain([0, yMax])
    .range([chartY + chartHeight, chartY]);

  // Background stripes
  const bgGroup = svg.append("g").attr("class", "plot-background");

  data.forEach(d => {
    bgGroup.append("rect")
      .attr("x", x(d.product))
      .attr("y", chartY)
      .attr("width", x.bandwidth())
      .attr("height", chartHeight);
  });

  // Grid
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${chartX},0)`)
    .call(
      d3.axisLeft(y)
        .tickValues(d3.range(0, yMax + 1, 500))
        .tickSize(-chartWidth)
        .tickFormat("")
    );

  // Y axis
  svg.append("g")
    .attr("class", "axis y-axis")
    .attr("transform", `translate(${chartX},0)`)
    .call(
      d3.axisLeft(y)
        .tickValues(d3.range(0, yMax + 1, 500))
        .tickFormat(d3.format(","))
    );

  // X axis
  svg.append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0,${chartY + chartHeight})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end")
    .attr("dx", "-0.7em")
    .attr("dy", "0.35em");

  // Y axis label
  svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", `translate(25, ${chartY + chartHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("Volume in million metric tons");

  // Bars
  svg.append("g")
    .selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.product))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.value))
    // .on("mousemove", function(event, d) {
    //   d3.selectAll(".bar").classed("active", false);
    //   d3.select(this).classed("active", true);

    //   tooltip
    //     .style("opacity", 1)
    //     .html(`
    //       <div class="tooltip-title">${d.product}</div>
    //       <div class="tooltip-value">${d3.format(",.2f")(d.value)} million metric tons</div>
    //     `);

    //   const [mouseX, mouseY] = d3.pointer(event, svg.node());

    //   // // chart 영역 범위
    //   const minX = chartX;
    //   const maxX = chartX + chartWidth;

    //   const minY = chartY;
    //   const maxY = chartY + chartHeight;

    //   // clamp (범위 제한)
    //   const clampedX = Math.max(minX, Math.min(maxX, mouseX));
    //   const clampedY = Math.max(minY, Math.min(maxY, mouseY));

    //   // tooltip 위치
    //   tooltip
    //     .style("left", `${clampedX - 64}px`)
    //     .style("top", `${clampedY - 68}px`);
        
    //   // tooltip
    //   //   .style("left", `${mouseX + 14}px`)
    //   //   .style("top", `${mouseY - 18}px`);
    // })
    // .on("mouseleave", function() {
    //   d3.select(this).classed("active", false);
    //   tooltip.style("opacity", 0);
    // });

  // overlay
  const overlay = svg.append("rect")
  .attr("class", "overlay")
  .attr("x", chartX)
  .attr("y", chartY)
  .attr("width", chartWidth)
  .attr("height", chartHeight)
  .attr("fill", "transparent")
  .style("pointer-events", "all");

  overlay
  .on("mousemove", function(event) {
    const [mx, my] = d3.pointer(event, svg.node());

    const hovered = data.find(d => {
      const x0 = x(d.product);
      const x1 = x0 + x.bandwidth();
      return mx >= x0 && mx <= x1;
    });

    if (!hovered) {
      bars.classed("active", false);
      tooltip.style("opacity", 0);
      return;
    }

    bars.classed("active", d => d.product === hovered.product);

    tooltip
      .style("opacity", 1)
      .html(`
        <div class="tooltip-title">${hovered.product}</div>
        <div class="tooltip-value">${d3.format(",.2f")(hovered.value)} million metric tons</div>
      `)
      .style("left", `${mx + 14}px`)
      .style("top", `${Math.max(chartY, my - 18)}px`);
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