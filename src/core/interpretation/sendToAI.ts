import type { IAnswer } from "@/core/models/interface/IAnswer";
import type { AIrequest } from "@/core/models/types/AIrequest";

export async function sendToAIPost({
  path,
  prompt,
  model = "llava:latest",
  images,
}: AIrequest): Promise<IAnswer> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model, images }),
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`AI server error: ${r.status}\n${msg}`);
  }

  return await r.json();
}