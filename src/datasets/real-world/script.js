const data = [
  { country: "Burundi", urban: 24, agriculture: 85, region: "Africa" },
  { country: "Niger", urban: 18, agriculture: 71, region: "Africa" },
  { country: "Chad", urban: 27, agriculture: 69, region: "Africa" },
  { country: "Madagascar", urban: 36, agriculture: 69, region: "Africa" },
  { country: "Central African Republic", urban: 44, agriculture: 70, region: "Africa" },
  { country: "Ethiopia", urban: 23, agriculture: 62, region: "Africa" },
  { country: "Rwanda", urban: 29, agriculture: 55, region: "Africa" },
  { country: "Eritrea", urban: 34, agriculture: 61, region: "Africa" },
  { country: "DR Congo", urban: 44, agriculture: 55, region: "Africa" },
  { country: "Guinea-Bissau", urban: 46, agriculture: 50, region: "Africa" },
  { country: "Cameroon", urban: 54, agriculture: 44, region: "Africa" },
  { country: "Benin", urban: 51, agriculture: 28, region: "Africa" },
  { country: "Lesotho", urban: 42, agriculture: 29, region: "Africa" },
  { country: "Eswatini", urban: 26, agriculture: 14, region: "Africa" },
  { country: "Gabon", urban: 94, agriculture: 30, region: "Africa" },
  { country: "Angola", urban: 69, agriculture: 56, region: "Africa" },
  { country: "Algeria", urban: 76, agriculture: 11, region: "Africa" },

  { country: "Nepal", urban: 67, agriculture: 61, region: "Asia" },
  { country: "Afghanistan", urban: 25, agriculture: 45, region: "Asia" },
  { country: "Bhutan", urban: 42, agriculture: 43, region: "Asia" },
  { country: "Bangladesh", urban: 31, agriculture: 35, region: "Asia" },
  { country: "Kyrgyzstan", urban: 35, agriculture: 24, region: "Asia" },
  { country: "Maldives", urban: 41, agriculture: 8, region: "Asia" },
  { country: "Turkey", urban: 88, agriculture: 15, region: "Asia" },
  { country: "Syria", urban: 72, agriculture: 16, region: "Asia" },
  { country: "Iraq", urban: 69, agriculture: 8, region: "Asia" },
  { country: "Bahrain", urban: 99, agriculture: 1, region: "Asia" },

  { country: "Albania", urban: 58, agriculture: 35, region: "Europe" },
  { country: "Bosnia and Herz.", urban: 51, agriculture: 18, region: "Europe" },
  { country: "Poland", urban: 60, agriculture: 7, region: "Europe" },
  { country: "Austria", urban: 73, agriculture: 3, region: "Europe" },
  { country: "Channel Islands", urban: 34, agriculture: 2, region: "Europe" },

  { country: "Belize", urban: 41, agriculture: 16, region: "North America" },
  { country: "Honduras", urban: 57, agriculture: 24, region: "North America" },
  { country: "Barbados", urban: 59, agriculture: 2, region: "North America" },

  { country: "Ecuador", urban: 62, agriculture: 31, region: "South America" },
  { country: "Bolivia", urban: 70, agriculture: 26, region: "South America" },
  { country: "Peru", urban: 87, agriculture: 24, region: "South America" },
  { country: "Colombia", urban: 81, agriculture: 16, region: "South America" },
  { country: "Brazil", urban: 89, agriculture: 8, region: "South America" },
  { country: "Argentina", urban: 86, agriculture: 1, region: "South America" },

  { country: "Samoa", urban: 17, agriculture: 30, region: "Oceania" },
  { country: "Fiji", urban: 57, agriculture: 29, region: "Oceania" }
];

const color = d3.scaleOrdinal()
  .domain(["North America", "South America", "Africa", "Europe", "Asia", "Oceania"])
  .range([
    "#e07a5f",
    "#a85d5d",
    "#b06ab3",
    "#6c8ebf",
    "#2a9d8f",
    "#5ab4c3"
  ]);

const container = document.getElementById("chart");
const tooltip = d3.select("#tooltip");

const width = 980;
const height = 640;
const margin = { top: 60, right: 170, bottom: 80, left: 72 };

const innerWidth = width - margin.left - margin.right;
const innerHeight = height - margin.top - margin.bottom;

const svg = d3.select("#chart")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`)
  .attr("width", "100%")
  .attr("height", "auto");

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear()
  .domain([0, 100])
  .range([0, innerWidth]);

const y = d3.scaleLinear()
  .domain([0, 100])
  .range([innerHeight, 0]);

const xAxis = d3.axisBottom(x)
  .tickValues([0, 20, 40, 60, 80, 100])
  .tickFormat(d => `${d}%`);

const yAxis = d3.axisLeft(y)
  .tickValues([0, 20, 40, 60, 80, 100])
  .tickFormat(d => `${d}%`);

const xGrid = d3.axisBottom(x)
  .tickValues([0, 20, 40, 60, 80, 100])
  .tickSize(-innerHeight)
  .tickFormat("");

const yGrid = d3.axisLeft(y)
  .tickValues([0, 20, 40, 60, 80, 100])
  .tickSize(-innerWidth)
  .tickFormat("");

g.append("g")
  .attr("class", "grid")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(xGrid);

g.append("g")
  .attr("class", "grid")
  .call(yGrid);

g.append("g")
  .attr("class", "axis")
  .attr("transform", `translate(0,${innerHeight})`)
  .call(xAxis);

g.append("g")
  .attr("class", "axis")
  .call(yAxis);

g.append("text")
  .attr("class", "axis-label")
  .attr("x", innerWidth / 2)
  .attr("y", innerHeight + 54)
  .attr("text-anchor", "middle")
  .text("Share of population living in urban areas");

g.append("text")
  .attr("class", "y-top-title")
  .attr("x", 0)
  .attr("y", -22)
  .attr("text-anchor", "start")
  .text("Share of people employed in agricultural sector");

const points = g.append("g")
  .selectAll("circle")
  .data(data)
  .join("circle")
  .attr("class", "point")
  .attr("cx", d => x(d.urban))
  .attr("cy", d => y(d.agriculture))
  .attr("r", 4.5)
  .attr("fill", d => color(d.region))
  .attr("stroke", "#ffffff")
  .attr("stroke-width", 1);

const hoverLabel = g.append("g")
  .style("pointer-events", "none")
  .style("display", "none");

hoverLabel.append("text")
  .attr("class", "point-label")
  .attr("id", "hover-label-text");

points
  .on("mouseenter", function(event, d) {
    d3.select(this)
      .raise()
      .transition()
      .duration(100)
      .attr("r", 7)
      .attr("stroke-width", 2);

    hoverLabel.style("display", null);
    hoverLabel
      .attr("transform", `translate(${x(d.urban) + 8}, ${y(d.agriculture) - 10})`);

    hoverLabel.select("#hover-label-text")
      .text(d.country);

    tooltip
      .style("opacity", 1)
      .html(`
        <div class="tt-title">${d.country}</div>
        <div><strong>Urban population:</strong> ${d.urban.toFixed(1)}%</div>
        <div><strong>Agricultural employment:</strong> ${d.agriculture.toFixed(1)}%</div>
        <div><strong>Region:</strong> ${d.region}</div>
      `);
  })
  .on("mousemove", function(event) {
    tooltip
      .style("left", `${event.clientX + 12}px`)
      .style("top", `${event.clientY + 12}px`);
  })
  .on("mouseleave", function() {
    d3.select(this)
      .transition()
      .duration(100)
      .attr("r", 4.5)
      .attr("stroke-width", 1);

    hoverLabel.style("display", "none");
    tooltip.style("opacity", 0);
  });

const legend = d3.select("#legend");

color.domain().forEach(region => {
  const item = legend.append("div").attr("class", "legend-item");
  item.append("span")
    .attr("class", "legend-swatch")
    .style("background", color(region));
  item.append("span").text(region);
});