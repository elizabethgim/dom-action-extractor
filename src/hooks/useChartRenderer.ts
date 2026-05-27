import { useState } from "react";
import { loadChart } from "@/core/charts/loadChart";
import { hook, clearHookRegistry } from "@/core/actionExtractor/hook";
import { resetExtractRegistries } from "@/core/actionExtractor/extractActions";
import { clearActionIdIndex } from "@/core/actionExtractor/actionIdStore";
import { resetSemanticRegistry } from "@/core/actionExtractor/semanticRegistry";
import type { ChartMetadata } from "@/core/models/types/ChartMetadata";

export function useChartRenderer(containerRef: React.RefObject<HTMLElement | null>) {
  const [renderedChartId, setRenderedChartId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);

  async function renderChart(chartMeta: ChartMetadata) {
    setIsRendering(true);

    try {
      const container = containerRef.current;
      if (!container) throw new Error("chart container not found");
      container.innerHTML = "";

      clearHookRegistry();
      resetExtractRegistries();
      clearActionIdIndex();
      resetSemanticRegistry();

      await hook();

      const chart = loadChart(chartMeta);
      await chart.mount(container);

      setRenderedChartId(chartMeta.id);
      setRenderVersion((v) => v + 1);
    } finally {
      setIsRendering(false);
    }
  }

  function resetRendered() {
    setRenderedChartId(null);
  }

  return { renderedChartId, renderVersion, isRendering, renderChart, resetRendered };
}
