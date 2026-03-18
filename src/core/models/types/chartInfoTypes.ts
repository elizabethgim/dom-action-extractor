export type ChartSourceType = "d3" | "observable" | "iframe";

export type ChartInfo = {
  chartId: string;
  sourceType: ChartSourceType;

  title: string;
  description?: string;
  markdown?: string;

  tags?: string[];
  source?: string;
}