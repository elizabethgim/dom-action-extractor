export function tokenize(text: string, lang: "ko" | "en") {
  if (lang === "ko") {
    // 한국어는 형태소 분석기가 없으면 일단 공백 기반 (추후 교체)
    return text
      .replace(/[^\w\s가-힣]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }
  return text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map(s => s.toLowerCase())
    .filter(Boolean);
}