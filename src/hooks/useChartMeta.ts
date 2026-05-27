import { useEffect, useState } from "react";
import { getChartCatalog } from "@/api/chartApi";
import   type { ChartMetadata } from "@core/models/types/ChartMetadata";

export type Source = string;
export type Family = string;

export function getSource(chart: ChartMetadata): Source {
  return chart.source;
}

export function getFamily(chart: ChartMetadata): Family {
  return chart.family;
}

export function getTitle(chart: ChartMetadata | null | undefined): string {
  return chart?.title ?? "";
}

export function useChartCatalog() {
  const [charts, setCharts] = useState<ChartMetadata[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [chartCatalogError, setChartCatalogError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoadingCharts(true);
      try {
        const nextCharts = await getChartCatalog();
        if (!cancelled) {
          setCharts(nextCharts);
          setChartCatalogError(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Falling back to local chart catalog.", error);
          setChartCatalogError(error as Error);
        }
      } finally {
        if (!cancelled) setIsLoadingCharts(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { charts, isLoadingCharts, chartCatalogError };
}
