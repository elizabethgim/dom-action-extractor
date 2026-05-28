import { generatePrompt } from "@/core/prompts/answer";
import { getActionHistory } from "@/core/actionExtractor/actionLogger";
import { getActionRegistry } from "@/core/actionExtractor/extractActions";
import { findMatchingEffects } from "@/core/actionExtractor/semanticRegistry";
import { getImages } from "@/core/utils/getImages";
import { sendToAIPost } from "@/core/interpretation/sendToAI";
import { getCleanResponse } from "@/core/utils/getCleanResponse";

import type { imageState } from "@core/models/interface/IimageState";
import type { IAnswer } from "@/core/models/interface/IAnswer";

export async function decideNextAction(
  chartType: string,
  questions: string,
  chartState: imageState | null,
  signal?: AbortSignal,
): Promise<string> {

  const actionHistoryRegistry = await getActionHistory();
  const actionRegistry = await getActionRegistry();
  const semanticContext = findMatchingEffects(actionRegistry);
  const prompt = await generatePrompt(
    chartType,
    questions,
    actionHistoryRegistry,
    actionRegistry,
    semanticContext,
  );
  console.log("prompt: ", prompt);
  
  const img = getImages(chartState, null);

  const response = await sendToAIPost({
    path: "/chat",
    prompt,
    images: img,
    signal,
  });
  console.log("answer:", response);

  const plan: string = await getCleanResponse(response);
  return plan;
}

export function getAnswer(plan:string): IAnswer {
    let answer = null;
    
    try {
      answer = JSON.parse(plan);
    } catch (e) {
      console.log("PLAN JSON PARSE FAILED. Raw:", plan);
      console.error(e);
    }

    return answer;
}