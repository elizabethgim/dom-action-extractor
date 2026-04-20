import * as d3 from "d3";
import { data } from "./data";
import "./style.css";

export function renderChart(container: HTMLElement): void {
  container.classList.add("mean-bar-container");

  const width = 900;
  const height = 420;
  const margin = { top: 30, right: 80, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // 1. Scales
  const x = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, innerWidth])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value) || 0])
    .nice()
    .range([innerHeight, 0]);

  // 2. Axes
  svg.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x));

  svg.append("g").call(d3.axisLeft(y));

  // 3. Bars
  const bars = svg.selectAll(".bar")
    .data(data)
    .join("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.label) || 0)
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.value))
    .attr("fill", "#4e79a7");

  // 4. Average Line & Label
  const avgLine = svg.append("line")
    .attr("class", "avg-line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", "4,4")
    .style("pointer-events", "none");

  const avgLabel = svg.append("text")
    .attr("class", "avg-label")
    .attr("x", innerWidth + 5)
    .attr("fill", "red")
    .attr("font-size", "12px")
    .style("pointer-events", "none");

  // 5. Update Average Function
  const updateAverage = (selectedData: typeof data) => {
    if (selectedData.length === 0) {
      avgLine.style("display", "none");
      avgLabel.style("display", "none");
      return;
    }

    const meanValue = d3.mean(selectedData, d => d.value) || 0;
    const yPos = y(meanValue);

    avgLine.style("display", null)
      .attr("y1", yPos)
      .attr("y2", yPos);

    avgLabel.style("display", null)
      .attr("y", yPos + 5)
      .text(`Avg: ${meanValue.toFixed(1)}`);
  };

  // 6. Brush Interaction
  const brush = d3.brushX()
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("brush end", (event) => {
      const selection = event.selection;

      if (!selection) {
        // 선택 영역이 없으면(클릭으로 해제 시) 전체 평균으로 복구
        bars.style("opacity", 1);
        updateAverage(data);
        return;
      }

      const [x0, x1] = selection as [number, number];
      
      // 막대의 '중심점'이 드래그 구간 내에 있는지 판단
      const selected = data.filter(d => {
        const center = (x(d.label) || 0) + x.bandwidth() / 2;
        return center >= x0 && center <= x1;
      });

      // 선택된 막대만 강조
      bars.style("opacity", d => {
        const center = (x(d.label) || 0) + x.bandwidth() / 2;
        return center >= x0 && center <= x1 ? 1 : 0.2;
      });

      // 실시간으로 평균 계산 및 업데이트
      updateAverage(selected);
    });

  // 브러시 레이어를 막대 위에 추가
  svg.append("g")
    .attr("class", "brush")
    .call(brush);

  // 초기 상태: 전체 데이터 평균 표시
  updateAverage(data);
}