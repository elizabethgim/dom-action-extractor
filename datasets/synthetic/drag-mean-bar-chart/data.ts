// mean-bar-chart/data.ts
export interface BarData {
  label: string;
  value: number;
}

export const data: BarData[] = [
  { label: "A", value: 10 },
  { label: "B", value: 25 },
  { label: "C", value: 15 },
  { label: "D", value: 40 },
];