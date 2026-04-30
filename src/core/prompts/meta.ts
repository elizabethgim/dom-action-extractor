import type { ChartMeta } from "@core/models/types/ChartMeta";


export function getMetaPrompt(xAxis: string, yAxis: string){
  return `
  You are a Chart Question and Answering assistant for dynamic charts.
  First I'm giving you the chart's x and y axis of this chart.

  x-axis: ${xAxis}
  
  y-axis: ${yAxis}

  `
}

export function buildPromptWithMeta(args: {
  meta: ChartMeta | null;
  chartTypeHint?: string; // 기존 chartType이 있으면 같이 주기
}) {
  const { meta, chartTypeHint } = args;

  const metaBlock = buildChartContext(meta, 1200);

  return [
    `You are a ChartQA assistant for interactive charts.`,
    `Use the chart meta info to understand what the chart shows.`,
    ``,
    metaBlock,
    chartTypeHint ? `\nUI Hint chartType: ${chartTypeHint}` : "",
    ``,
  ].join("\n");
}


export function buildChartContext(meta: ChartMeta | null, maxDescChars = 1200) {
  if (!meta) return "Chart meta: (not available)";

  // auto/manual 구조면 auto 우선
  const title = meta.auto?.title ?? meta.title ?? meta.id;
  const chartType = meta.auto?.chartType ?? meta.chartType ?? "unknown";
  const descRaw = meta.auto?.description ?? meta.description ?? "";
  const description = clip(descRaw, maxDescChars);

  const tags = meta.manual?.tags?.length ? meta.manual.tags.join(", ") : "";

  return [
    `Chart Meta`,
    `- id: ${meta.id}`,
    `- title: ${title}`,
    `- chartType: ${chartType}`,
    tags ? `- tags: ${tags}` : null,
    description ? `- description:\n${description}` : `- description: (empty)`,
  ]
    .filter(Boolean)
    .join("\n");
}


function clip(s: string, maxChars: number) {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...[truncated]";
}