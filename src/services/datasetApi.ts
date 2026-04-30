const DATASET_API_BASE = import.meta.env.VITE_DATASET_API_BASE ?? "";

export type EmploymentRow = {
  country: string;
  code: string | null;
  year: number;
  agriculture: number;
  urban: number;
  region: string;
};

export type EmploymentDatasetResponse = {
  dataset_id: "employment";
  title: string;
  description: string;
  year: number;
  row_count: number;
  rows: EmploymentRow[];
};

export async function getEmploymentDataset(year = 2023): Promise<EmploymentDatasetResponse> {
  const url = new URL(`${DATASET_API_BASE}/api/datasets/employment/data`, window.location.origin);
  url.searchParams.set("year", String(year));

  const response = await fetch(url.toString());
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Failed to load employment dataset: ${response.status}\n${message}`);
  }

  return response.json() as Promise<EmploymentDatasetResponse>;
}
