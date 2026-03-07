// data.ts
function d(iso: string) {
  // 로컬/타임존 이슈 줄이려고 YYYY-MM-DD를 Date로 명시 파싱
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

/**
 * 예시 데이터: "dataset 중 하나"를 여기서는
 * (너 시스템에서 자주 등장하는) interaction types를 시계열로 본다고 가정해서 만들었어.
 * - Click / Hover / Drag 3개 series
 * - 주간 단위 변화
 *
 * 네가 실제 dataset을 붙일 때도 "series/date/value"만 맞추면 index.ts는 그대로 재사용 가능.
 */
export const data: MultiLineDatum[] = [
  // Click
  { date: d("2025-12-01"), series: "Click", value: 12 },
  { date: d("2025-12-08"), series: "Click", value: 18 },
  { date: d("2025-12-15"), series: "Click", value: 14 },
  { date: d("2025-12-22"), series: "Click", value: 21 },
  { date: d("2025-12-29"), series: "Click", value: 17 },
  { date: d("2026-01-05"), series: "Click", value: 25 },
  { date: d("2026-01-12"), series: "Click", value: 22 },
  { date: d("2026-01-19"), series: "Click", value: 29 },

  // Hover
  { date: d("2025-12-01"), series: "Hover", value: 30 },
  { date: d("2025-12-08"), series: "Hover", value: 28 },
  { date: d("2025-12-15"), series: "Hover", value: 35 },
  { date: d("2025-12-22"), series: "Hover", value: 31 },
  { date: d("2025-12-29"), series: "Hover", value: 38 },
  { date: d("2026-01-05"), series: "Hover", value: 42 },
  { date: d("2026-01-12"), series: "Hover", value: 39 },
  { date: d("2026-01-19"), series: "Hover", value: 45 },

  // Drag
  { date: d("2025-12-01"), series: "Drag", value: 6 },
  { date: d("2025-12-08"), series: "Drag", value: 9 },
  { date: d("2025-12-15"), series: "Drag", value: 7 },
  { date: d("2025-12-22"), series: "Drag", value: 12 },
  { date: d("2025-12-29"), series: "Drag", value: 11 },
  { date: d("2026-01-05"), series: "Drag", value: 15 },
  { date: d("2026-01-12"), series: "Drag", value: 13 },
  { date: d("2026-01-19"), series: "Drag", value: 16 },
];


// data.ts
import * as d3 from "d3";

export type MultiLineDatum = {
  date: Date;
  series: string;
  value: number;
};

type WideRow = Record<string, string>;

export async function loadUnemploymentData(): Promise<MultiLineDatum[]> {
  const csvText = await fetch(
    new URL("./unemployment.csv", import.meta.url)
  ).then((r) => {
    if (!r.ok) throw new Error(`Failed to load csv: ${r.status}`);
    return r.text();
  });

  const table = d3.csvParse(csvText) as unknown as WideRow[];

  // 첫 컬럼 = x축 (date), 나머지 = series
  const columns = (table as any).columns as string[];
  const dateKey = columns[0];
  const seriesKeys = columns.slice(1);

  const parseDate = d3.timeParse("%Y-%m-%d");

  const out: MultiLineDatum[] = [];

  for (const row of table) {
    const rawDate = row[dateKey];
    if (!rawDate) continue;

    const date = parseDate?.(rawDate) ?? new Date(rawDate);
    if (Number.isNaN(+date)) continue;

    for (const key of seriesKeys) {
      const v = row[key];
      if (!v) continue;

      const value = +v;
      if (Number.isNaN(value)) continue;

      out.push({ date, series: key, value });
    }
  }

  return out;
}
