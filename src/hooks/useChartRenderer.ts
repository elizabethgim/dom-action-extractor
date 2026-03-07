import { useState } from "react";
import type { ChartId } from "@core/charts/chartRegistry";
import { loadChart } from "@core/charts/loadChart";
import { hook } from "@core/actionExtractor/hook";

export function useChartRenderer(containerRef: React.RefObject<HTMLElement | null>) {
  const [renderedChartId, setRenderedChartId] = useState<ChartId | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  async function renderChart(chartId: ChartId) {
    setIsRendering(true);

    try {
      const container = containerRef.current;
      if (!container) throw new Error("chart container not found");
      container.innerHTML = "";

      await hook();

      const chart = await loadChart(chartId);
      await chart.mount(container);
      
      setRenderedChartId(chartId);
    } finally {
      setIsRendering(false);
    }
  }

  function resetRendered() {
    setRenderedChartId(null);
  }

  return { renderedChartId, isRendering, renderChart, resetRendered };
}