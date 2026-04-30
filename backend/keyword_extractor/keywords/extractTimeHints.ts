export function extractTimeHints(text: string) {
  // 예시: year + month range
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
  const monthMap: Record<string, number> = {
    jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,
    jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12
  };

  const lower = text.toLowerCase();
  // "january to march" / "jan - mar"
  const range = lower.match(/\b([a-z]{3,9})\b\s*(to|-|~)\s*\b([a-z]{3,9})\b/);
  const from = range?.[1];
  const to = range?.[3];

  const fromMonth = from && monthMap[from] ? monthMap[from] : undefined;
  const toMonth = to && monthMap[to] ? monthMap[to] : undefined;

  return {
    year: year ? Number(year) : undefined,
    fromMonth,
    toMonth
  };
}