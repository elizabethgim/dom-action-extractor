import { getAiRun } from "@/api/aiRunApi";

export async function replayRun(runId: string){
  const run = await getAiRun(runId);
  
}