import type { ChartId } from "@core/charts/chartRegistry";

export type Source = "observable" | "dataset" | "csv" | "tableau";
export type Family = "line" | "bar" | "hierarchy" | "tree" | "map" | "network" | "other";

type ChartEntry =
  | { source: Exclude<Source, "tableau-html">; family: Family; title: string }
  | { source: "tableau-html"; family: "tableau"; title: string; htmlPath: string };

const chartMeta: Partial<Record<ChartId, ChartEntry>> = {
  "observable:zoom-area": { source: "observable", family: "line", title: "Zoomable Area" },
  "observable:index-line": { source: "observable", family: "line", title: "Index Line" },
  "observable:multiple-line": { source: "observable", family: "line", title: "Multiple Line (Obs)" },
  "dataset:collapsible-tree": { source: "dataset", family: "tree", title: "Collapsible Tree" },
  "dataset:mean-bar-chart": { source: "dataset", family: "bar", title: "Mean Line Bar" },
  "dataset:hierarchical-bar": { source: "dataset", family: "bar", title: "Hierarchical Bar" },
  "dataset:multiple-line": { source: "dataset", family: "line", title: "Multiple Line" },
  "csv:zoomable-sunburst": { source: "csv", family: "hierarchy", title: "Zoomable Sunburst" },
  "tableau:wall-e": { source: "tableau-html", family: "tableau", title: "Wall-e", htmlPath: "/tableau/index.html" },
};

export function getSource(id: ChartId): Source {
  return (chartMeta[id]?.source ?? (id.split(":")[0] as Source)) as Source;
}
export function getFamily(id: ChartId): Family {
  return (chartMeta[id]?.family ?? "other") as Family;
}
export function getTitle(id: ChartId): string {
  return chartMeta[id]?.title ?? id;
}