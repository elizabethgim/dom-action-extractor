export type SendAIArgs = {
  path: string;
  prompt: string;
  model?: string;
  images?: string[];
};

export type AIResponse = any; // 일단 any, 나중에 스키마 정하면 바꾸기

export async function sendToAIPost({
  path,
  prompt,
  model = "llava:latest",
  images,
}: SendAIArgs): Promise<AIResponse> {
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