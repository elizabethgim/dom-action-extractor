import { chartRegistry } from "@/core/charts/chartRegistry";
import type { ChartInfo } from "@/core/models/types/chartInfoTypes";

/**
 * chartRegistry 엔트리의 getInfo()를 통해 차트 설명을 가져온다.
 * - 엔트리에 getInfo가 없으면 fallback을 만든다.
 */
export async function getChartInfo(chartId: string): Promise<ChartInfo> {
  const entry = chartRegistry[chartId];

  // entry 자체가 없을 때(이론상 ChartId면 없으면 안 되지만, 안전)
  if (!entry) {
    return {
      chartId,
      sourceType: "d3",
      title: chartId,
      description: "Chart entry not found in registry.",
    };
  }

  // getInfo가 있으면 그걸 사용
  if (typeof entry.getInfo === "function") {
    // entry.getInfo가 sync일 수도 있으니 Promise.resolve로 감쌈
    return await Promise.resolve(entry.getInfo(chartId));
  }

  // fallback
  return {
    chartId,
    sourceType: "d3",
    title: entry.id ?? chartId,
    description: "No getInfo() implemented for this chart.",
  };
}