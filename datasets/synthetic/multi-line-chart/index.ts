// index.ts
import * as d3 from "d3";
import { data, type MultiLineDatum } from "./data";
import "./style.css";

export function renderChart(container: HTMLElement): void {
  container.classList.add("multiline-root");
  container.innerHTML = "";

  const width = 900;
  const height = 420;
  const margin = { top: 24, right: 120, bottom: 44, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---- Prep
  const seriesNames = Array.from(new Set(data.map((d) => d.series)));

  const bySeries = d3.group(data, (d) => d.series);

  const xDomain = d3.extent(data, (d) => d.date) as [Date, Date];
  const yMax = d3.max(data, (d) => d.value) ?? 0;

  // ---- Scales
  const x = d3.scaleTime().domain(xDomain).range([0, innerW]).nice();
  const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

  // (색은 CSS에서 주기 애매하니까 d3 scheme 사용)
  const color = d3.scaleOrdinal<string>().domain(seriesNames).range(d3.schemeTableau10);

  // ---- Axes
  g.append("g")
    .attr("class", "axis axis-x")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6));

  g.append("g").attr("class", "axis axis-y").call(d3.axisLeft(y).ticks(6));

  g.append("text")
    .attr("class", "axis-label")
    .attr("x", -innerH / 2)
    .attr("y", -42)
    .attr("transform", "rotate(-90)")
    .attr("text-anchor", "middle")
    .text("Value");

  // ---- Line generator
  const line = d3
    .line<MultiLineDatum>()
    .x((d) => x(d.date))
    .y((d) => y(d.value));

  // ---- Draw lines
  const linesG = g.append("g").attr("class", "lines");

  const seriesG = linesG
    .selectAll("g.series")
    .data(seriesNames, (d) => d)
    .join("g")
    .attr("class", "series");

  seriesG
    .append("path")
    .attr("class", "series-line")
    .attr("fill", "none")
    .attr("stroke", (name) => String(color(name)))
    .attr("d", (name) => line((bySeries.get(name) ?? []).slice().sort((a, b) => +a.date - +b.date))!);

  // ---- Legend
  const legend = g
    .append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerW + 12}, 0)`);

  const legendItem = legend
    .selectAll("g.legend-item")
    .data(seriesNames)
    .join("g")
    .attr("class", "legend-item")
    .attr("transform", (_, i) => `translate(0, ${i * 18})`);

  legendItem
    .append("line")
    .attr("x1", 0)
    .attr("x2", 16)
    .attr("y1", 8)
    .attr("y2", 8)
    .attr("stroke", (d) => String(color(d)));

  legendItem
    .append("text")
    .attr("x", 22)
    .attr("y", 12)
    .text((d) => d);

  // ---- Hover interaction: nearest series 강조 + tooltip + focus dot
  const tooltip = d3
    .select(container)
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none");

  const focus = g.append("g").attr("class", "focus").style("display", "none");

  focus.append("circle").attr("r", 4);

  // overlay for pointer events
  g.append("rect")
    .attr("class", "overlay")
    .attr("width", innerW)
    .attr("height", innerH)
    .on("pointerenter", () => {
      tooltip.style("display", "block");
      focus.style("display", null);
    })
    .on("pointerleave", () => {
      tooltip.style("display", "none");
      focus.style("display", "none");
      seriesG.classed("is-dimmed", false).classed("is-active", false);
    })
    .on("pointermove", (event) => {
      const [mx] = d3.pointer(event);
      const x0 = x.invert(mx);

      // x에 대해 가장 가까운 point를 series별로 찾아서, 그 중 y거리까지 고려해 "가장 가까운 series" 선택
      let best:
        | { series: string; point: MultiLineDatum; dist2: number }
        | null = null;

      for (const s of seriesNames) {
        const pts = (bySeries.get(s) ?? []).slice().sort((a, b) => +a.date - +b.date);
        if (pts.length === 0) continue;

        const i = d3.bisector<MultiLineDatum, Date>((d) => d.date).left(pts, x0, 1);
        const a = pts[i - 1] ?? pts[0];
        const b = pts[i] ?? pts[pts.length - 1];
        const p =
          Math.abs(+x0 - +a.date) < Math.abs(+x0 - +b.date) ? a : b;

        const dx = x(p.date) - mx;
        const dy = y(p.value) - d3.pointer(event)[1];
        const dist2 = dx * dx + dy * dy;

        if (!best || dist2 < best.dist2) best = { series: s, point: p, dist2 };
      }

      if (!best) return;

      // highlight
      seriesG.classed("is-dimmed", true).classed("is-active", false);
      seriesG
        .filter((d) => d === best!.series)
        .classed("is-dimmed", false)
        .classed("is-active", true);

      // focus dot
      focus
        .attr("transform", `translate(${x(best.point.date)},${y(best.point.value)})`);
      focus.select("circle").attr("fill", String(color(best.series)));

      // tooltip
      const fmtDate = d3.timeFormat("%Y-%m-%d");
      tooltip
        .html(
          `<div class="tt-title">${best.series}</div>
           <div>${fmtDate(best.point.date)}</div>
           <div><b>${best.point.value}</b></div>`
        )
        .style("left", `${margin.left + x(best.point.date) + 12}px`)
        .style("top", `${margin.top + y(best.point.value) + 12}px`);
    });
}
