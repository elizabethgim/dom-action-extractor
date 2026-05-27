import { getAiRun } from "@/api/aiRunApi";

export async function replayRun(runId: number){
  const run = await getAiRun(runId);
  
}