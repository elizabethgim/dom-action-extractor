import * as d3 from "d3";
import { getEmploymentDataset } from "@/services/datasetApi";
import "./styles.css";

const regionOrder = [
  "North America",
  "South America",
  "Africa",
  "Europe",
  "Asia",
  "Oceania"
];

const colors = {
  "North America": "#df7d6b",
  "South America": "#9b4f57",
  "Africa": "#ad62ab",
  "Europe": "#6680b2",
  "Asia": "#269a95",
  "Oceania": "#64b6c2"
};

const labelsToShow = new Set([
  "Burundi",
  "Niger",
  "Chad",
  "Ethiopia",
  "Eritrea",
  "Rwanda",
  "Central African Republic",
  "Laos",
  "DR Congo",
  "Guinea-Bissau",
  "Afghanistan",
  "Bhutan",
  "Bangladesh",
  "Samoa",
  "Lesotho",
  "Cameroon",
  "Angola",
  "Benin",
  "Eswatini",
  "Morocco",
  "Albania",
  "Fiji",
  "Botswana",
  "Gabon",
  "Bolivia",
  "Peru",
  "Turkey",
  "Brazil",
  "Colombia",
  "Algeria",
  "Iraq",
  "Poland",
  "Bosnia and Herz.",
  "Belize",
  "Barbados",
  "Austria",
  "Argentina",
  "Bahrain",
  "Channel Islands",
  "Kyrgyzstan",
  "Maldives"
]);

const margin = { top: 170, right: 210, bottom: 110, left: 72 };
const plotWidth = 1135;
const legendWidth = 190;
const width = margin.left + plotWidth + legendWidth + 40;
const height = 1000;
const innerWidth = plotWidth;
const innerHeight = 640;

export async function index(container) {
  const root = d3.select(container).classed("employment-chart-host", true);
  root.selectAll("*").remove();

  const host = root
    .append("div")
    .attr("class", "employment-chart-root");

  const svg = host
    .append("svg")
    .attr("id", "chart")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "auto");

  svg
    .append("text")
    .attr("class", "title")
    .attr("x", 28)
    .attr("y", 46)
    .text("Employment in agriculture vs. urban population, 2023");

  svg
    .append("text")
    .attr("class", "subtitle")
    .attr("x", 28)
    .attr("y", 90)
    .text("Share of total employment from the agricultural sector, versus the share of population living in urban areas.");

  svg
    .append("text")
    .attr("class", "source-note")
    .attr("x", 28)
    .attr("y", height - 38)
    .text("Data source: ILO via World Bank; World Urbanization Prospects - UN Population Division, via World Bank (2026)");

  svg
    .append("text")
    .attr("class", "credit-note")
    .attr("x", 28)
    .attr("y", height - 6)
    .text("OurWorldinData.org/urbanization | CC BY");

  const chartG = svg
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const tooltip = host
    .append("div")
    .attr("class", "tooltip");

  const dataset = await getEmploymentDataset(2023);
  const data = dataset.rows;

  const x = d3.scaleLinear().domain([0, 100]).range([0, innerWidth]);
  const y = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);

  const xAxis = d3
    .axisBottom(x)
    .tickValues([0, 20, 40, 60, 80, 100])
    .tickFormat(d => `${d}%`);

  const yAxis = d3
    .axisLeft(y)
    .tickValues([0, 20, 40, 60, 80, 100])
    .tickFormat(d => `${d}%`);

  const xGrid = d3
    .axisBottom(x)
    .tickValues([0, 20, 40, 60, 80, 100])
    .tickSize(-innerHeight)
    .tickFormat("");

  const yGrid = d3
    .axisLeft(y)
    .tickValues([0, 20, 40, 60, 80, 100])
    .tickSize(-innerWidth)
    .tickFormat("");

  chartG
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xGrid);

  chartG.append("g").attr("class", "grid").call(yGrid);

  chartG
    .append("g")
    .attr("class", "axis x-axis")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis);

  chartG
    .append("g")
    .attr("class", "axis y-axis")
    .call(yAxis)
    .call(g => g.select(".domain").remove());

  chartG
    .append("text")
    .attr("class", "top-axis-title")
    .attr("x", 0)
    .attr("y", -26)
    .text("Share of people employed in agricultural sector");

  chartG
    .append("text")
    .attr("class", "axis-label")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 68)
    .attr("text-anchor", "middle")
    .text("Share of population living in urban areas");

  const plot = chartG.append("g");

  const dots = plot
    .selectAll(".dot")
    .data(data)
    .join("circle")
    .attr("class", "dot")
    .attr("cx", d => x(d.urban))
    .attr("cy", d => y(d.agriculture))
    .attr("r", 5)
    .attr("fill", d => colors[d.region] || "#999")
    .on("mouseenter", function (event, d) {
      const [mx, my] = d3.pointer(event, host.node());
      d3.select(this).classed("active", true).attr("r", 7);

      dots.classed("dimmed", p => p !== d);

      tooltip
        .style("opacity", 1)
        .html(buildTooltipHtml(d))
        .style("left", `${mx + 16}px`)
        .style("top", `${my - 20}px`);
    })
    .on("mousemove", function (event, d) {
      const [mx, my] = d3.pointer(event, host.node());

      tooltip
        .html(buildTooltipHtml(d))
        .style("left", `${mx + 16}px`)
        .style("top", `${my - 20}px`);
    })
    .on("mouseleave", function () {
      d3.select(this).classed("active", false).attr("r", 5);
      dots.classed("dimmed", false);
      tooltip.style("opacity", 0);
    });

  const labeledData = data.filter(d => labelsToShow.has(d.country));

  chartG
    .append("g")
    .selectAll(".label-text")
    .data(labeledData)
    .join("text")
    .attr("class", "label-text")
    .attr("x", d => x(d.urban) + 4)
    .attr("y", d => y(d.agriculture) - 6)
    .attr("fill", d => colors[d.region] || "#555")
    .text(d => d.country);

  const legendX = innerWidth + 34;
  const legendY = 10;
  const legendSpacing = 30;

  const legend = chartG.append("g");

  const legendItems = legend
    .selectAll(".legend-item")
    .data(regionOrder)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(${legendX}, ${legendY + i * legendSpacing})`);

  legendItems
    .append("rect")
    .attr("x", 0)
    .attr("y", -8)
    .attr("width", 16)
    .attr("height", 16)
    .attr("fill", d => colors[d]);

  legendItems
    .append("text")
    .attr("x", 24)
    .attr("y", 0)
    .attr("fill", "#3c3c3c")
    .text(d => d);

  legendItems
    .on("mouseenter", function (_, region) {
      dots.classed("dimmed", d => d.region !== region);
    })
    .on("mouseleave", function () {
      dots.classed("dimmed", false);
    });
}

function buildTooltipHtml(d) {
  const fmt = d3.format(".1f");
  return `
    <div class="tooltip-title">${d.country}</div>
    <div class="tooltip-region">${d.region}</div>
    <div>Urban population: <strong>${fmt(d.urban)}%</strong></div>
    <div>Agricultural employment: <strong>${fmt(d.agriculture)}%</strong></div>
  `;
}
