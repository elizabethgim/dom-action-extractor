import { useEffect, useMemo, useState } from "react";
import type { ChartId } from "@/core/charts/chartRegistry";
import { getFamily, getSource, getTitle, type Family, type Source } from "./useChartMeta";
import type { ChartMetadata } from "@/services/chartApi";

export function useChartFilters(chartCatalog: ChartMetadata[]) {
  // --- UI state ---
  const [source, setSource] = useState<Source | "">("");
  const [family, setFamily] = useState<Family | "">("");
  const [selectedChartId, setSelectedChartId] = useState<ChartId | "">("");
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  // source options
  const sources = useMemo(() => {
    return Array.from(new Set(chartCatalog.map(getSource))).sort();
  }, [chartCatalog]);

  // family options based on source
  const families = useMemo(() => {
    if (!source) return [];
    const f = chartCatalog.filter((chart) => getSource(chart) === source).map(getFamily);
    return Array.from(new Set(f)).sort();
  }, [chartCatalog, source]);

  // chart options based on source+family
  const charts = useMemo(() => {
    if (!source || !family) return [];
    return chartCatalog
      .filter((chart) => getSource(chart) === source && getFamily(chart) === family)
      .sort((a, b) => getTitle(a).localeCompare(getTitle(b)));
  }, [chartCatalog, source, family]);

  // questions for selected chart
  const questions = useMemo(() => {
    if (!selectedChartId) return [];
    return chartCatalog.find((chart) => chart.id === selectedChartId)?.questions ?? [];
  }, [chartCatalog, selectedChartId]);

  // families가 바뀌었는데 현재 family가 유효하지 않으면 첫 값으로 교정
  useEffect(() => {
    if (families.length === 0) return;
    if(!family || !families.includes(family as Family)){
      setFamily(families[0]);
    }
    // if (!families.includes(family as Family)) setFamily(families[0]);
  }, [families, family]); 

  // charts가 바뀌면 selectedChartId가 유효한지 보장 + 질문 인덱스 리셋
  useEffect(() => {
    if (charts.length === 0) {
      setSelectedChartId("");
      setSelectedQuestionIndex(0);
      return;
    }

    setSelectedChartId((prev) => {
      if (prev && charts.some((chart) => chart.id === prev)) return prev;
      return charts[0]?.id ?? "";
    });
  }, [charts]);

  // chart 바뀌면 질문 index 리셋
  useEffect(() => {
    setSelectedQuestionIndex(0);
  }, [selectedChartId]);

  return {
    source, setSource,
    family, setFamily,
    selectedChartId, setSelectedChartId,
    selectedQuestionIndex, setSelectedQuestionIndex,

    sources, families, charts, questions,
  };
}
