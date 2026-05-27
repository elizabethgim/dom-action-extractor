import { useEffect, useState } from "react";
import type { ChartInfo } from "@core/models/types/chartInfoTypes";
import { chartRegistry } from "@core/charts/chartRegistry";

export function useChartInfo(selectedChartId: string | "" | null | undefined) {
  const [info, setInfo] = useState<ChartInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!selectedChartId) {
        setInfo(null);
        setError(null);
        setLoading(false);
        return;
      }

      const entry = chartRegistry[selectedChartId];
      if (!entry) {
        setInfo({
          chartId: selectedChartId,
          sourceType: "d3",
          title: selectedChartId,
          description: "Chart entry not found in registry.",
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (typeof entry.getInfo !== "function") {
          setInfo({
            chartId: selectedChartId,
            sourceType: "d3",
            title: entry.id ?? selectedChartId,
            description: "No getInfo() implemented for this chart.",
          });
          return;
        }

        const r = await Promise.resolve(entry.getInfo(selectedChartId));
        if (!cancelled) setInfo(r);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedChartId]);

  return { info, loading, error };
}