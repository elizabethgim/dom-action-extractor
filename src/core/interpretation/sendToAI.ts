import type { AIrequest } from "@/core/models/types/AIrequest";

export async function sendToAIPost({
  path,
  prompt,
  model = "qwen3.6:latest",
  images,
  signal,
}: AIrequest & { signal?: AbortSignal }): Promise<string> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, images }),
    signal,
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`AI server error: ${r.status}\n${msg}`);
  }

  const json = await r.json();
  return json.text ?? json.response ?? JSON.stringify(json);
}