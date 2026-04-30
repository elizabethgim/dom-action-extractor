import { chartRegistry } from "@/core/charts/chartRegistry";

const CHART_API_BASE = import.meta.env.VITE_CHART_API_BASE ?? "";

export type ChartMetadata = {
  id: string;
  title: string;
  source: string;
  family: string;
  renderer: string;
  description?: string;
  dataset_id?: string | null;
  questions: string[];
};

const fallbackCharts: ChartMetadata[] = [
  {
    id: "dataset:collapsible-tree",
    title: "Collapsible Tree",
    source: "dataset",
    family: "tree",
    renderer: "d3",
    questions: [
      "What is the common ancesstor of S and J?",
      "What is the max depth of this tree?",
      "How many children nodes are there in node A?",
    ],
  },
  {
    id: "observable:zoom-area",
    title: "Zoomable Area",
    source: "observable",
    family: "line",
    renderer: "observable",
    questions: ["How many flights were there in 1992 January to March?"],
  },
  {
    id: "observable:multiple-line",
    title: "Multiple Line (Observable)",
    source: "observable",
    family: "line",
    renderer: "observable",
    questions: [""],
  },
  {
    id: "observable:index-line",
    title: "Index Line",
    source: "observable",
    family: "line",
    renderer: "observable",
    questions: [
      "What is the difference between Amazon and Gooogle stock price at 2018 January?",
    ],
  },
  {
    id: "observable:zoomable-icicle",
    title: "Zoomable Icicle",
    source: "observable",
    family: "hierarchy",
    renderer: "observable",
    questions: [],
  },
  {
    id: "observable:zoomable-circle-packing",
    title: "Zoomable Circle Packing",
    source: "observable",
    family: "hierarchy",
    renderer: "observable",
    questions: [],
  },
  {
    id: "observable:bivariate-choropleth",
    title: "Bivariate Choropleth",
    source: "observable",
    family: "map",
    renderer: "observable",
    questions: [""],
  },
  {
    id: "dataset:multiple-line",
    title: "Multiple Line",
    source: "dataset",
    family: "line",
    renderer: "d3",
    questions: [
      "What is the exact value of Drag at December 21st?",
      "Which interaction type had the highest growth rate between Dec 2025 and Jan 2026?",
      "What is the total sum of all interactions for the week of Jan 05?",
      "Are there any specific correlations between 'Hover' and 'Click' events in this dataset?",
    ],
  },
  {
    id: "dataset:mean-bar-chart",
    title: "Mean Line Bar",
    source: "dataset",
    family: "bar",
    renderer: "d3",
    questions: ["What is the average of B and C?"],
  },
  {
    id: "dataset:hierarchical-bar",
    title: "Hierarchical Bar",
    source: "dataset",
    family: "bar",
    renderer: "d3",
    questions: ["What is the value of D?"],
  },
  {
    id: "csv:zoomable-sunburst",
    title: "Zoomable Sunburst",
    source: "csv",
    family: "hierarchy",
    renderer: "d3",
    questions: [
      "Which departament used the most health care service?",
      "Which sector receives the highest total budget?",
      "Which sector has the lowest funding?",
      "What is the difference in budget between Defense and Education?",
      "Which sector ranks second in total allocation?",
      "How much larger is Healthcare compared to Infrastructure?",
      "Within Education, which subcategory receives the most funding?",
      "In Healthcare, which area has the smallest allocation?",
      "Within Defense, how much is allocated to Personnel compared to Equipment?",
      "Which subcategory dominates Infrastructure spending?",
      "In Welfare, is Pension funding larger than Child Support?",
    ],
  },
  {
    id: "tableau:wall-e",
    title: "Wall-e",
    source: "tableau",
    family: "tableau",
    renderer: "iframe",
    questions: [""],
  },
  {
    id: "csv:covid",
    title: "COVID Cases",
    source: "csv",
    family: "line",
    renderer: "d3",
    dataset_id: "covid",
    questions: [],
  },
  {
    id: "csv:childMortality",
    title: "Child Mortality",
    source: "csv",
    family: "line",
    renderer: "d3",
    dataset_id: "child_mortality",
    questions: [],
  },
  {
    id: "csv:employment",
    title: "Employment in Agriculture vs. Urban Population",
    source: "csv",
    family: "scatter",
    renderer: "d3",
    dataset_id: "employment",
    questions: [],
  },
];

function onlyRenderable(charts: ChartMetadata[]) {
  return charts.filter((chart) => chart.id in chartRegistry);
}

export function getFallbackChartCatalog() {
  return onlyRenderable(fallbackCharts);
}

export async function getChartCatalog(): Promise<ChartMetadata[]> {
  const url = new URL(`${CHART_API_BASE}/charts`, window.location.origin);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(await response.text());

  const charts = (await response.json()) as ChartMetadata[];
  return onlyRenderable(charts);
}

export type ChartCreatePayload = {
  slug: string;
  title: string;
  source: string;
  family: string;
  renderer: string;
  description?: string;
  dataset_id?: string | null;
  questions: string[];
};

export async function createChart(payload: ChartCreatePayload): Promise<ChartMetadata> {
  const url = new URL(`${CHART_API_BASE}/charts`, window.location.origin);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json()) as { detail?: string };
    throw new Error(err.detail ?? "Failed to create chart");
  }

  return (await response.json()) as ChartMetadata;
}
