// Tiny relay so the app's `/chat` calls (proxied by vite.config.ts to
// http://0.0.0.0:3000) reach a real Ollama server. The app posts
// { prompt, model, images } and expects { response } or { text } back;
// Ollama's /api/generate takes almost the same shape but needs
// `stream: false` and lives on port 11434, not 3000 — this just bridges that.
import http from "node:http";

const PORT = Number(process.env.CHAT_RELAY_PORT ?? 3000);
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";

async function pickModel(requested) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const { models } = await res.json();
    const names = models.map((m) => m.name);
    if (names.includes(requested)) return requested;
    // fall back to any vision-capable model if the requested one isn't installed
    const vision = models.find((m) => m.details?.families?.includes("clip"));
    console.warn(`[chat-relay] model "${requested}" not found; falling back to "${vision?.name ?? names[0]}"`);
    return vision?.name ?? names[0] ?? requested;
  } catch {
    return requested;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200).end("ok");
    return;
  }
  if (req.method !== "POST" || req.url !== "/chat") {
    res.writeHead(404).end("not found");
    return;
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { prompt, model, images } = JSON.parse(body);
      const resolvedModel = await pickModel(model);

      const ollamaRes = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resolvedModel,
          prompt,
          images: images ?? [],
          stream: false,
        }),
      });

      if (!ollamaRes.ok) {
        const text = await ollamaRes.text();
        res.writeHead(ollamaRes.status, { "Content-Type": "text/plain" }).end(text);
        return;
      }

      const json = await ollamaRes.json();
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: json.response }));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" }).end(String(err));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[chat-relay] listening on :${PORT}, forwarding to ${OLLAMA_URL}`);
});
