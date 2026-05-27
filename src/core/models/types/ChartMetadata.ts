export type ChartMetadata = {
  id: string;
  slug: string;
  title: string;
  source: string;
  family: string;
  renderer: string;
  description?: string;
  dataset_id?: string | null;
  questions: string[];
};