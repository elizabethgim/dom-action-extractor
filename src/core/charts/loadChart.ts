import type { ChartMetadata } from "@core/models/types/ChartMetadata";
import type { ChartRenderer } from "@core/models/types/ChartRenderer";
import { d3Adapter } from "./d3Adapter";
import { observableAdapter } from "./observableAdapter";
import { iframeAdapter } from "./iframeAdpater";
import { chartRegistry } from "./chartRegistry";

// export async function loadChart(id: ChartId) {
//   const chart = chartRegistry[id];
//   console.log("chart: ", chart);

//   if (!chart) throw new Error(`Unknown chart id: ${id}`);
//   return chart;
// }


// export async function loadChart(chart: ChartMetadata){
//   const key = `${chartRegistry.source}:${chart.slug}`;
//   const renderer = chartRegistry[key];
//   if (!renderer) throw new Error(`No renderer for ${key}`);
//   return renderer;
// }

export function loadChart(chart: ChartMetadata): ChartRenderer{
  const fn = chartRegistry[chart.slug];

  if (!fn && chart.renderer !== "iframe") {
    throw new Error(`No render function found for chart id: ${chart.id}`);
  }

  switch (chart.renderer) {
    case "d3":
      return d3Adapter(fn, chart.slug);

    case "observable":
      return observableAdapter(fn, chart.slug);

    case "iframe":
      return iframeAdapter(`/tableau/${chart.slug}/index.html`);

    default:
      throw new Error(`Unknown renderer: ${chart.renderer}`);
  }
}