export type Keyword = {
  text: string;
  type: "TIME" | "AGG_MAX" | "AGG_MIN" | "AGG_AVG" | "TERM";
  score: number;
};

export type KeywordResult = {
  language: "ko" | "en";
  keywords: Keyword[];
  numbers: { text: string; value: number }[];
  normalized: {
    time: { year?: number; fromMonth?: number; toMonth?: number };
  };
};

export async function fetchKeywords(text: string, signal?: AbortSignal): Promise<KeywordResult> {
  const res = await fetch("/keywords", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error(`keyword API ${res.status}`);
  return res.json() as Promise<KeywordResult>;
}
