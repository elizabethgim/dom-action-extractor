import { generateChartElements } from "./prompt/generateChartElements";
import { sendToGemini } from "./sendToGemini";
import { appendLogItem } from "../UI/loading";
import { extractTags } from "@/actionExtractor/element";
import { sendToAIPost } from "./sendToAI";

export async function getChartType(container: HTMLElement, img:string[]){
  await extractTags(container);
  const prompt = await generateChartElements();
  // const res = await sendToGemini(prompt, img);
  const res = await sendToAIPost({path:"/chat", prompt, images: img, loadingId: "typeLoading" });
  if(!res) throw new Error("No response from AI server");

  appendLogItem("typeBody", res.text);
  console.log(res);
  return res;
}