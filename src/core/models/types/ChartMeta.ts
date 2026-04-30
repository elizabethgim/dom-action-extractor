export type ChartMeta = {
  id: string;
  title?: string;
  description?: string;
  chartType?: string;
  source?: string;

  // 우리가 auto/manual 분리했으면:
  auto?: {
    title?: string;
    description?: string;
    chartType?: string;
    entryFile?: string;
  };
  manual?: {
    tags?: string[];
    difficulty?: number;
  };
};