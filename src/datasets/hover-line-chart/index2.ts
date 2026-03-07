import * as d3 from "d3";

/**
 * Relative Change Line Chart: Life Expectancy
 * Visualizes how life expectancy changes relative to a selected year.
 */
export async function renderChart(container: HTMLElement) {
    const width = 928;
    const height = 600;
    const marginTop = 20;
    const marginRight = 60;
    const marginBottom = 30;
    const marginLeft = 60;

    container.innerHTML = "";

    try {
        const rawData = await d3.csv("lex.csv");
        const years = Object.keys(rawData[0]).filter(k => /^\d{4}$/.test(k)).map(Number);
        
        // Transform data into series
        const series = rawData.map(d => {
            return {
                name: d.name,
                values: years.map(year => ({
                    year: year,
                    value: parseFloat(d[year.toString()])
                })).filter(v => !isNaN(v.value))
            };
        }).filter(s => s.values.length > 0);

        // x-scale (Year)
        const x = d3.scaleLinear()
            .domain(d3.extent(years) as [number, number])
            .range([marginLeft, width - marginRight])
            .clamp(true);

        // Compute max ratio for log scale domain
        // k is the maximum ratio between max and min value across all series
        const k = d3.max(series, ({values}) => d3.max(values, d => d.value)! / d3.min(values, d => d.value)!);
        
        const y = d3.scaleLog()
            .domain([1 / k!, k!])
            .rangeRound([height - marginBottom, marginTop]);

        const z = d3.scaleOrdinal(d3.schemeCategory10)
            .domain(series.map(d => d.name));

        const bisect = d3.bisector((d: any) => d.year).left;

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", [0, 0, width, height])
            .attr("style", "max-width: 100%; height: auto; -webkit-tap-highlight-color: transparent;");

        // Axes
        svg.append("g")
            .attr("transform", `translate(0,${height - marginBottom})`)
            .call(d3.axisBottom(x).ticks(width / 80).tickFormat(d3.format("d")))
            .call(g => g.select(".domain").remove());

        svg.append("g")
            .attr("transform", `translate(${marginLeft},0)`)
            .call(d3.axisLeft(y).ticks(null, (x: number) => x.toFixed(1) + "×"))
            .call(g => g.selectAll(".tick line").clone()
                .attr("stroke-opacity", d => d === 1 ? null : 0.2)
                .attr("x2", width - marginLeft - marginRight))
            .call(g => g.select(".domain").remove());

        const rule = svg.append("g")
            .append("line")
            .attr("y1", height)
            .attr("y2", 0)
            .attr("stroke", "black");

        const serie = svg.append("g")
            .style("font", "bold 10px sans-serif")
            .selectAll("g")
            .data(series)
            .join("g");

        const line = d3.line<any>()
            .x(d => x(d.year))
            .y(d => y(d.value));

        serie.append("path")
            .attr("fill", "none")
            .attr("stroke-width", 1.5)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke", d => z(d.name))
            .attr("d", d => line(d.values));

        serie.append("text")
            .datum(d => ({name: d.name, value: d.values[d.values.length - 1].value, initial: d.values[0].value}))
            .attr("fill", d => z(d.name))
            .attr("paint-order", "stroke")
            .attr("stroke", "white")
            .attr("stroke-width", 3)
            .attr("x", x.range()[1] + 3)
            .attr("y", d => y(d.value / d.initial))
            .attr("dy", "0.35em")
            .text(d => d.name);

        function update(year: number) {
            rule.attr("transform", `translate(${x(year) + 0.5},0)`);
            
            serie.attr("transform", function(d) {
                const i = bisect(d.values, year, 0, d.values.length - 1);
                // Shift so that the value at index 'i' is normalized to y(1)
                const currentVal = d.values[i].value;
                const referenceVal = d.values[0].value;
                // Vertical shift in log scale: log(v/ref) - log(target/ref)
                return `translate(0,${y(1) - y(currentVal / referenceVal)})`;
            });

            // Update text positions
            serie.select("text")
                .attr("y", function(d: any) {
                    const i = bisect(d.values, year, 0, d.values.length - 1);
                    const lastVal = d.values[d.values.length - 1].value;
                    const refVal = d.values[i].value;
                    return y(lastVal / refVal);
                });
        }

        d3.transition()
            .ease(d3.easeCubicOut)
            .duration(1500)
            .tween("year", () => {
                const i = d3.interpolateNumber(years[years.length - 1], years[0]);
                return t => update(i(t));
            });

        svg.on("mousemove touchmove", function(event) {
            const [mx] = d3.pointer(event, this);
            update(Math.round(x.invert(mx)));
        });

        update(years[0]);

    } catch (err) {
        container.innerHTML = `<div style="color:red; padding:20px;">Error: ${err}</div>`;
    }

    return svg.node();
}
