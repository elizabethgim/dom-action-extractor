

  const svg = d3.create("svg")
    .attr("id", "chart")
    .attr("width", 900)
    .attr("height", 500);

  const selected = d3.select("#chart");
  console.log("chart exists?", !selected.empty(), selected.node());

  svg.append("text")
    .attr("x", 900 / 2)   // 가운데 정렬
    .attr("y", 20)        // 위쪽 위치
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("COVID-19 Cases per Million");

  const margin = {top: 20, right: 30, bottom:30, left: 50}

  const width = 900 - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  d3.csv("daily-new-confirmed-covid-19-cases-per-million-people.csv").then(rawData => {
    console.log("columns:", rawData.columns);
    console.log(rawData[0]);
    const valueColumn = "Daily new confirmed cases of COVID-19 per million people (rolling 7-day average)";

    const parseDate = d3.timeParse("%Y-%m-%d");
    const keys = ["Canada", "United States", "United Kingdom", "France", "Germany"];

    const data = rawData.map(d => ({
      entity: d.Entity,
      date: parseDate(d["Day"]),
      value: +d["New cases (per 1M)"] || 0,
    })).filter(d=>d.date && d.entity);
    
    // group
    const grouped = d3.groups(data, d => +d.date);

    // wide format
    const transformedData = grouped.map(([dateKey, values]) => {
      const row = { date: new Date(+dateKey)};
      
      keys.forEach(k =>{
        row[k] = 0;
      });

      values.forEach(v => {
        row[v.entity] = v.value;
      });

      return row;
    }).sort((a, b) => a.date - b.date);

    // const grouped = d3.groups(data, d => d.date.getTime());

    // const transformedData = grouped.map(([dateKey, values]) => {
    //   const row = { date: new Date(+dateKey) };
    //   keys.forEach(k => row[k] = 0);
    //   values.forEach(v => {
    //     if (keys.includes(v.entity)) {
    //       row[v.entity] = v.value;
    //     }
    //   });
    //   return row;
    // }).sort((a, b) => a.date - b.date);
    
    console.log(transformedData[0]);

    // stack
    const stack = d3.stack().keys(keys);
    const stackedData = stack(transformedData);

    const x = d3.scaleTime()
      .domain(d3.extent(transformedData, d => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(stackedData, d => d3.max(d, i => i[1]))])
      .nice()
      .range([height, 0]);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const area = d3.area()
      .x(d=>x(d.data.date))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]));

    g.selectAll("path")
      .data(stackedData)
      .enter()
      .append("path")
      .attr("fill", d => color(d.key))
      .attr("d", area);

    g.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x));

    g.append("g")
    .call(d3.axisLeft(y));

    // legend
    const legend = g.append("g")
      .attr("transform", `translate(${width - 120}, 10)`);

    keys.forEach((key, i) => {
      const row = legend.append("g")
        .attr("transform", `translate(0, ${i * 22})`);

      row.append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", color(key));

      row.append("text")
        .attr("x", 20)
        .attr("y", 12)
        .style("font-size", "12px")
        .text(key);
    });


  // 1. tooltip group (SVG 내부에 추가)
    const tooltipGroup = g.append("g")
      .attr("class", "tooltip")
      .attr("pointer-events", "none") // 툴팁이 마우스 이벤트를 막지 않도록 설정
      .attr("display", "none"); // 초기엔 숨김

    // 1-1. 배경 사각형
    const tooltipBg = tooltipGroup.append("rect")
      .attr("class", "tooltip-bg")
      .attr("fill", "rgba(255, 255, 255, 0.9)")
      .attr("stroke", "#ccc")
      .attr("rx", 4) // 둥근 모서리
      .attr("ry", 4);

    // 1-2. 텍스트 요소 (줄바꿈을 위해 tspan 사용)
    const tooltipText = tooltipGroup.append("text")
      .attr("x", 10) // 배경 사각형 내부 여백
      .attr("y", 20)
      .attr("font-size", "12px")
      .attr("fill", "#333");

    // 2. 마우스 데이터를 위한 Bisector
    const bisectDate = d3.bisector(d => d.date).left;

    // 3. 마우스 이벤트를 수신할 투명한 사각형 레이어 (가장 위에 추가)
    const overlay = g.append("rect")
      .attr("class", "overlay")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "none")
      .attr("pointer-events", "all");

    const verticalLine = g.append("line")
      .attr("class", "vertical-line")
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4") // 점선 스타일 (선택 사항)
      .style("display", "none")
      .attr("pointer-events", "none");
      
    overlay
      .on("mousemove", function(event) {
        // 마우스 위치에 따른 날짜 계산
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisectDate(transformedData, x0, 1);
        const d0 = transformedData[i - 1];
        const d1 = transformedData[i];
        if (!d1) return; // 데이터 범위를 벗어날 경우 방지
        const d = x0 - d0.date > d1.date - x0 ? d1 : d0;

        verticalLine
          .attr("x1", x(d.date))
          .attr("x2", x(d.date))
          .style("display", "block");
          
        // 4. 툴팁 텍스트 업데이트 (tspan 활용)
        tooltipText.selectAll("tspan").remove(); // 기존 텍스트 제거

        // 날짜 타이틀
        tooltipText.append("tspan")
          .attr("x", 10)
          .attr("dy", "0")
          .attr("font-weight", "bold")
          .text(d3.timeFormat("%Y-%m-%d")(d.date));

        let total = 0;
        // 각 국가별 데이터 추가 (역순으로 표시)
        [...keys].reverse().forEach((key, index) => {
          const val = d[key] || 0;
          total += val;
          tooltipText.append("tspan")
            .attr("x", 10)
            .attr("dy", "1.4em") // 줄바꿈 간격
            .attr("fill", color(key))
            .text("■ ")
            .append("tspan")
            .attr("fill", "#333") // 국가명과 값은 기본 색상
            .attr("font-weight", "normal")
            .text(`${key}: ${val.toLocaleString(undefined, {maximumFractionDigits: 1})}`);
        });

        // 합계
        tooltipText.append("tspan")
          .attr("x", 10)
          .attr("dy", "1.6em")
          .attr("font-weight", "bold")
          .text(`Total: ${total.toLocaleString(undefined, {maximumFractionDigits: 1})}`);

        // 5. 툴팁 배경 크기 및 위치 동적 조정
        const bbox = tooltipText.node().getBBox(); // 텍스트 크기 측정
        tooltipBg
          .attr("width", bbox.width + 20)
          .attr("height", bbox.height + 15);

        // 마우스 위치에 따른 툴팁 위치 계산 (차트 경계를 넘지 않도록)
        let xPos = x(d.date) + 15;
        let yPos = d3.pointer(event)[1] - 15;

        // 툴팁이 오른쪽 끝을 넘을 경우 왼쪽으로 이동
        if (xPos + bbox.width + 20 > width) {
          xPos = x(d.date) - bbox.width - 35;
        }

        tooltipGroup
          .attr("transform", `translate(${xPos}, ${yPos})`)
          .attr("display", "block");
      })
      .on("mouseout", () => {
        verticalLine.style("display", "none"); // 마우스 나가면 선 숨기기
        tooltipGroup.attr("display", "none"); // 마우스가 차트를 벗어나면 툴팁 숨김
      });

  });
