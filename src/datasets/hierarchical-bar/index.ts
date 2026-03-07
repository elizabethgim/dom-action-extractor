import * as d3 from 'd3';
import { data } from "./data";

// --- Types ---
interface DataNode {
  name: string;
  value?: number;
  children?: DataNode[];
}

type HierarchyNode = d3.HierarchyNode<DataNode> & { index?: number };

// --- Configuration ---
const width = 960;
const barStep = 27;
const barPadding = 3 / barStep;
const duration = 750;
const margin = { top: 30, right: 30, bottom: 0, left: 100 };

// --- Scales & Helpers ---
const x = d3.scaleLinear().range([margin.left, width - margin.right]);
const color = d3.scaleOrdinal<boolean, string>([true, false], ["steelblue", "#aaa"]);

const stack = (i: number) => {
  let value = 0;
  return (d: HierarchyNode) => {
    const t = `translate(${x(value) - x(0)},${barStep * i})`;
    value += (d.value || 0);
    return t;
  };
};

const stagger = () => {
  let value = 0;
  return (d: HierarchyNode, i: number) => {
    const t = `translate(${x(value) - x(0)},${barStep * i})`;
    value += (d.value || 0);
    return t;
  };
};

// --- Core Drawing Functions ---

function createBar(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, 
  down: (svg: any, d: HierarchyNode) => void, 
  d: HierarchyNode, 
  selector: string
) {
  const g = svg.insert("g", selector)
    .attr("class", "enter")
    .attr("transform", `translate(0,${margin.top + barStep * barPadding})`)
    .attr("text-anchor", "end")
    .style("font", "10px sans-serif");

  const bar = g.selectAll<SVGGElement, HierarchyNode>("g")
    .data(d.children || [])
    .join("g")
    .attr("cursor", d => !d.children ? null : "pointer")
    .on("click", (event, d) => down(svg, d));

  bar.append("text")
    .attr("x", margin.left - 6)
    .attr("y", barStep * (1 - barPadding) / 2)
    .attr("dy", ".35em")
    .text(d => d.data.name);

  bar.append("rect")
    .attr("x", x(0))
    .attr("width", d => x(d.value || 0) - x(0))
    .attr("height", barStep * (1 - barPadding));

  return g;
}

function down(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, d: HierarchyNode) {
  if (!d.children || d3.active(svg.node())) return;

  svg.select(".background").datum(d);

  const transition1 = svg.transition().duration(duration);
  const transition2 = transition1.transition();

  const exit = svg.selectAll(".enter").attr("class", "exit");

  exit.selectAll("rect")
    .attr("fill-opacity", p => p === d ? 0 : null);

  exit.transition(transition1)
    .attr("fill-opacity", 0)
    .remove();

  const enter = createBar(svg, down, d, ".y-axis")
    .attr("fill-opacity", 0);

  enter.transition(transition1)
    .attr("fill-opacity", 1);

  enter.selectAll<SVGGElement, HierarchyNode>("g")
    .attr("transform", stack(d.index || 0))
    .transition(transition1)
    .attr("transform", stagger());

  x.domain([0, d3.max(d.children, d => d.value || 0) || 0]);

  svg.selectAll<SVGGElement, unknown>(".x-axis").transition(transition2)
    .call(d3.axisTop(x).ticks(width / 80, "s") as any);

  enter.selectAll<SVGGElement, HierarchyNode>("g").transition(transition2)
    .attr("transform", (_, i) => `translate(0,${barStep * i})`);

  enter.selectAll<SVGRectElement, HierarchyNode>("rect")
    .attr("fill", color(true))
    .attr("fill-opacity", 1)
    .transition(transition2)
    .attr("fill", d => color(!!d.children))
    .attr("width", d => x(d.value || 0) - x(0));
}

function up(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, d: HierarchyNode) {
  if (!d.parent || !svg.selectAll(".exit").empty()) return;

  svg.select(".background").datum(d.parent);

  const transition1 = svg.transition().duration(duration);
  const transition2 = transition1.transition();

  const exit = svg.selectAll(".enter").attr("class", "exit");

  x.domain([0, d3.max(d.parent.children || [], d => d.value || 0) || 0]);

  svg.selectAll<SVGGElement, unknown>(".x-axis").transition(transition1)
    .call(d3.axisTop(x).ticks(width / 80, "s") as any);

  exit.selectAll("g").transition(transition1)
    .attr("transform", stagger());

  exit.selectAll("g").transition(transition2)
    .attr("transform", stack(d.index || 0));

  exit.selectAll<SVGRectElement, HierarchyNode>("rect").transition(transition1)
    .attr("width", d => x(d.value || 0) - x(0))
    .attr("fill", color(true));

  exit.transition(transition2)
    .attr("fill-opacity", 0)
    .remove();

  const enter = createBar(svg, down, d.parent as HierarchyNode, ".exit")
    .attr("fill-opacity", 0);

  enter.selectAll("g")
    .attr("transform", (_, i) => `translate(0,${barStep * i})`);

  enter.transition(transition2)
    .attr("fill-opacity", 1);

  enter.selectAll<SVGRectElement, HierarchyNode>("rect")
    .attr("fill", d => color(!!d.children))
    .attr("fill-opacity", p => p === d ? 0 : null)
    .transition(transition2)
    .attr("width", d => x(d.value || 0) - x(0))
    .on("end", function() { d3.select(this).attr("fill-opacity", 1); });
}

// --- Main Chart Function ---
export function main(container: HTMLElement) : void {
  // console.log("hier main in");
  // d3.json(data).then(d => {
  //   console.log("data: ", d);
  //   if(d) renderChart("svg", d);
  // });
  
  if(data) {
    renderChart(container, data); // "svg" 대신 container를 넘기는 것이 관례입니다.
  } else {
    console.error("No data for hierarchical chart");
  }
}
function renderChart(containerSelector: HTMLElement, data: DataNode) {
  const root: HierarchyNode = d3.hierarchy(data)
    .sum(d => d.value || 0)
    .sort((a, b) => (b.value || 0) - (a.value || 0));

  // Assign indices for the stacking logic
  root.eachAfter(d => {
    const node = d as HierarchyNode;
    node.index = node.parent ? (node.parent.index = (node.parent.index || 0) + 1) : 0;
  });

  let max = 1;
  root.each(d => d.children && (max = Math.max(max, d.children.length)));
  const height = max * barStep + margin.top + margin.bottom;

  const svg = d3.select(containerSelector).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;");

  x.domain([0, root.value || 0]);

  svg.append("rect")
    .attr("class", "background")
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .attr("width", width)
    .attr("height", height)
    .attr("cursor", "pointer")
    .on("click", (event, d) => up(svg, d as HierarchyNode));

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top})`)
    .call(d3.axisTop(x).ticks(width / 80, "s"))
    .call(g => g.select(".domain").remove());

  svg.append("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${margin.left},0)`)
    .append("line")
    .attr("stroke", "currentColor")
    .attr("y1", margin.top)
    .attr("y2", height - margin.bottom);

  down(svg, root);
  
  return svg.node();
}