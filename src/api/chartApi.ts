import type { ChartMetadata } from "@/core/models/types/ChartMetadata";

const CHART_API_BASE = import.meta.env.VITE_CHART_API_BASE ?? "";

export async function getChartCatalog(): Promise<ChartMetadata[]> {
  const url = new URL(`${CHART_API_BASE}/api/charts`, window.location.origin);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(await response.text());
  console.log("response: ", response);

  return response.json() as Promise<ChartMetadata[]>;
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
  const url = new URL(`${CHART_API_BASE}/api/charts`, window.location.origin);

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
