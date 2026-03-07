import { sendToGemini } from "../ai/sendToGemini";
import { parseFirstJsonValue } from "../interpretation/getEffectJSON";
import type { IActions } from "../models/interface/IActions";
import type { IEffect } from "../models/interface/IEffect";
import { generateEffect } from "../ai/prompt/generateEffect";
import { captureState } from "../utils/getCapture";
import type { imageState } from "../utils/getCapture";
import { sendToAIPost } from "../ai/sendToAI";
import { showResponse } from "../../UI/effectResponse";
import { getCleanResponse } from "../utils/getCleanResponse";
import { getImages } from "../utils/getImages";
import { getActionRegistry } from "./extractActions";
import { getHookRegistry } from "./hook";
import { appendLogItem } from "../../UI/loading";

let effectRegistry: IEffect[] = [];

export async function getEffectRegistry() {
  return effectRegistry;
}

export async function extractEffect(
  chosen: IActions | null,
  captureId: string,
  before: imageState | null,
) {
  const after: imageState | null = await captureState("after", captureId);
  const listenerRegistry = getHookRegistry();

  const imgs = getImages(before, after);
  const actionRegistry = getActionRegistry();

  const effectPrompt = await generateEffect(
    chosen,
    actionRegistry,
    listenerRegistry,
  );
  console.log(JSON.stringify(effectPrompt));

  const effect = await sendToAIPost({
    path: "/chat",
    prompt: effectPrompt,
    images: imgs,
    loadingId: "effectLoading",
  });

  // const effect = await sendToGemini(effectPrompt, []);
  if(!effect) throw new Error("No response AI");
  await appendLogItem("effectBody", JSON.stringify(getCleanResponse(effect.text), null, 2));

  // const result = JSON.parse(effect);

  let parsed: any;

  try {
    parsed = JSON.parse(effect);
  } catch {
    // const fixed = await askJsonOnlyRetry(effect.text);
    parsed = parseFirstJsonValue(effect.text);
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  effectRegistry.push(...arr);
}

// interface IRespone {
//   text: IEffect;
//   model: string;
// }

// async function askJsonOnlyRetry(raw: string) {
//   const fixPrompt = `
// Your previous output was not valid JSON.

// Return ONLY a single valid JSON array.
// No markdown, no extra text.

// Here is the previous output:
// ${raw}
// `.trim();

//   return await sendToAIPost({ path: "/chat", prompt: fixPrompt });
// }
