import type { ChartMeta } from "@core/models/types/ChartMeta";

/**
 * Vite dev server에서 프로젝트 루트 아래 파일은 직접 접근 가능.
 * chartFolder 예: "zoomable-area-chart"
 */
export async function loadDatasetMeta(chartFolder: string): Promise<ChartMeta | null> {
  const url = `/datasets/${chartFolder}/meta.json`;

  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as ChartMeta;
  } catch {
    return null;
  }
}
