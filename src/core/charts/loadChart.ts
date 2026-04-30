import { chartRegistry } from "./chartRegistry";
import type { ChartId } from "./chartRegistry";

export async function loadChart(id: ChartId) {
  const chart = chartRegistry[id];
  console.log("chart: ", chart);

  if (!chart) throw new Error(`Unknown chart id: ${id}`);
  return chart;
}
