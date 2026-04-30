const STOPWORDS_EN = new Set([
  "the","a","an","and","or","but","if","then","to","of","in","on","for","with",
  "is","are","was","were","be","been","being","this","that","these","those",
  "how","many","what","which","who","when","where","why"
]);

export function scoreKeywords(tokens: string[], lang: "ko" | "en") {
  // 아주 단순: stopword 제거 + 길이/빈도 기반
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (lang === "en" && STOPWORDS_EN.has(t)) continue;
    if (t.length <= 2) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  const items = Array.from(freq.entries()).map(([text, f]) => {
    const score = Math.min(1, 0.4 + 0.2 * f + 0.02 * text.length);
    return { text, score };
  });

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 12);
}