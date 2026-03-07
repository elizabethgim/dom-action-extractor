function _1(md){return(
md`<div style="color: grey; font: 13px/25.5px var(--sans-serif); text-transform: uppercase;"><h1 style="display: none;">Line chart, multiple series</h1><a href="https://d3js.org/">D3</a> › <a href="/@d3/gallery">Gallery</a></div>

# Line chart, multiple series

This [line chart](/@d3/line-chart/2) shows the unemployment rate of various U.S. metro divisions from 2000 through 2013. On hover, the closest data point to the pointer and its associated series is highlighted. Data: [Bureau of Labor Statistics](https://www.bls.gov/)`
)}

function _voronoi(Inputs){return(
Inputs.toggle({label: "Show voronoi"})
)}

function _focus(Generators,chart){return(
Generators.input(chart)
)}

function _chart(d3,unemployment,voronoi)
{

  // Specify the chart’s dimensions.
  const width = 928;
  const height = 600;
  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 30;
  const marginLeft = 30;

  // Create the positional scales.
  const x = d3.scaleUtc()
    .domain(d3.extent(unemployment, d => d.date))
    .range([marginLeft, width - marginRight]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(unemployment, d => d.unemployment)]).nice()
    .range([height - marginBottom, marginTop]);

  // Create the SVG container.
  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .attr("style", "max-width: 100%; height: auto; overflow: visible; font: 10px sans-serif;");

  // Add the horizontal axis.
  svg.append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0));

  // Add the vertical axis.
  svg.append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y))
      .call(g => g.select(".domain").remove())
      .call(voronoi ? () => {} : g => g.selectAll(".tick line").clone()
          .attr("x2", width - marginLeft - marginRight)
          .attr("stroke-opacity", 0.1))
      .call(g => g.append("text")
          .attr("x", -marginLeft)
          .attr("y", 10)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
          .text("↑ Unemployment (%)"));


  // Compute the points in pixel space as [x, y, z], where z is the name of the series.
  const points = unemployment.map((d) => [x(d.date), y(d.unemployment), d.division]);

  // An optional Voronoi display (for fun).
  if (voronoi) svg.append("path")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("d", d3.Delaunay
        .from(points)
        .voronoi([0, 0, width, height])
        .render());

  // Group the points by series.
  const groups = d3.rollup(points, v => Object.assign(v, {z: v[0][2]}), d => d[2]);

  // Draw the lines.
  const line = d3.line();
  const path = svg.append("g")
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
    .selectAll("path")
    .data(groups.values())
    .join("path")
      .style("mix-blend-mode", "multiply")
      .attr("d", line);

  // Add an invisible layer for the interactive tip.
  const dot = svg.append("g")
      .attr("display", "none");

  dot.append("circle")
      .attr("r", 2.5);

  dot.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -8);

  svg
      .on("pointerenter", pointerentered)
      .on("pointermove", pointermoved)
      .on("pointerleave", pointerleft)
      .on("touchstart", event => event.preventDefault());

  return svg.node();

  // When the pointer moves, find the closest point, update the interactive tip, and highlight
  // the corresponding line. Note: we don't actually use Voronoi here, since an exhaustive search
  // is fast enough.
  function pointermoved(event) {
    const [xm, ym] = d3.pointer(event);
    const i = d3.leastIndex(points, ([x, y]) => Math.hypot(x - xm, y - ym));
    const [x, y, k] = points[i];
    path.style("stroke", ({z}) => z === k ? null : "#ddd").filter(({z}) => z === k).raise();
    dot.attr("transform", `translate(${x},${y})`);
    dot.select("text").text(k);
    svg.property("value", unemployment[i]).dispatch("input", {bubbles: true});
  }

  function pointerentered() {
    path.style("mix-blend-mode", null).style("stroke", "#ddd");
    dot.attr("display", null);
  }

  function pointerleft() {
    path.style("mix-blend-mode", "multiply").style("stroke", null);
    dot.attr("display", "none");
    svg.node().value = null;
    svg.dispatch("input", {bubbles: true});
  }

}


function _unemployment(FileAttachment){return(
FileAttachment("bls-metro-unemployment.csv").csv({typed: true})
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["bls-metro-unemployment.csv", {url: new URL("./files/cf77aaa2e0dab4123d57f842.csv", import.meta.url), mimeType: "text/csv", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer()).define(["md"], _1);
  main.variable(observer("viewof voronoi")).define("viewof voronoi", ["Inputs"], _voronoi);
  main.variable(observer("voronoi")).define("voronoi", ["Generators", "viewof voronoi"], (G, _) => G.input(_));
  main.variable(observer("focus")).define("focus", ["Generators","chart"], _focus);
  main.variable(observer("chart")).define("chart", ["d3","unemployment","voronoi"], _chart);
  main.variable(observer("unemployment")).define("unemployment", ["FileAttachment"], _unemployment);
  return main;
}
