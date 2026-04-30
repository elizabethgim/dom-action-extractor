import { generatePrompt } from "@/core/prompts/answer";
import { getActionHistory } from "@/core/actionExtractor/actionLogger";
import { getActionRegistry } from "@/core/actionExtractor/extractActions";
import { getImages } from "@/core/utils/getImages";
import { sendToAIPost } from "@/core/interpretation/sendToAI";
import { getCleanResponse } from "@/core/utils/getCleanResponse";

import type { imageState } from "@/core/utils/getCapture";
import type { IAnswer } from "@/core/models/interface/IAnswer";

export async function decideNextAction(
  chartType: string,
  questions: string,
  chartState: imageState | null,
): Promise<string> {

  console.log(chartState?.image);
  const actionHistoryRegistry = await getActionHistory();
  const actionRegistry = await getActionRegistry();
  const prompt = await generatePrompt(
    chartType,
    questions,
    actionHistoryRegistry,
    actionRegistry,
  );

  const img = getImages(chartState, null);

  const response = await sendToAIPost({
    path: "/chat",
    prompt,
    images: img,
  });
  console.log("answer:", response);

  const plan: string = await getCleanResponse(JSON.stringify(response));
  return plan;
}

export function getAnswer(plan:string): IAnswer {
    let answer = null;
    
    try {
      answer = JSON.parse(plan);
    } catch (e) {
      console.log("PLAN JSON PARSE FAILED. Raw:", answer);
      console.error(e);
    }

    return answer;
}