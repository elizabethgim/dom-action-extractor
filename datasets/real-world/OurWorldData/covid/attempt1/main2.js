import * as d3 from "d3";

export function index(container){
  const root = d3.select(container);

  const svg = root.append("svg")
    .attr("id", "chart")
    .attr("width", 900)
    .attr("height", 500);

  const margin = { top: 20, right: 30, bottom: 30, left: 60 };
  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  svg.append("text")
    .attr("x", 500)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("font-weight", "bold")
    .text("Daily confirmed COVID-19 cases per million people");

  svg.append("text")
    .attr("x", 500)
    .attr("y", 40)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("fill", "gray")
    .text("Selected countries");

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  d3.csv("daily-new-confirmed-covid-19-cases-per-million-people.csv").then(rawData => {
    const parseDate = d3.timeParse("%Y-%m-%d");

    // 나라 -> 대륙 매핑 예시
    // 네 CSV에 있는 나라들에 맞게 계속 추가해야 함
    const continentMap = {
      "Canada": "North America",
      "United States": "North America",
      "Mexico": "North America",

      "Germany": "Europe",
      "France": "Europe",
      "Italy": "Europe",
      "Spain": "Europe",
      "United Kingdom": "Europe",

      "China": "Asia",
      "Japan": "Asia",
      "South Korea": "Asia",
      "India": "Asia",

      "Nigeria": "Africa",
      "South Africa": "Africa",
      "Egypt": "Africa"
    };

    const keys = ["North America", "Europe", "Asia", "Africa"];

    // 파싱 + 필요한 데이터만 추리기
    const data = rawData
      .map(d => ({
        entity: d.Entity,
        date: parseDate(d.Day),
        value: +d["New cases (per 1M)"] || 0,
        continent: continentMap[d.Entity]
      }))
      .filter(d => d.date && d.continent);

    // 날짜별로 묶기
    const grouped = d3.groups(data, d => +d.date);

    // wide format으로 변환
    const transformedData = grouped.map(([dateKey, values]) => {
      const row = { date: new Date(+dateKey) };

      keys.forEach(k => {
        row[k] = 0;
      });

      values.forEach(v => {
        row[v.continent] += v.value;
      });

      return row;
    }).sort((a, b) => a.date - b.date);

    const stack = d3.stack().keys(keys);
    const stackedData = stack(transformedData);

    const x = d3.scaleTime()
      .domain(d3.extent(transformedData, d => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData[stackedData.length - 1], d => d[1])])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal()
      .domain(keys)
      .range(["#d73027", "#fc8d59", "#91bfdb", "#4575b4"]);

    const area = d3.area()
      .x(d => x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    g.selectAll(".layer")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("class", "layer")
      .attr("fill", d => color(d.key))
      .attr("d", area);

    g.append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x));

    g.append("g")
      .call(d3.axisLeft(y));

    console.log(transformedData.slice(0, 5));
  });
}