import { useState } from "react";
import type { ChartId } from "@/core/charts/chartRegistry";
import { v4 as uuidv4 } from "uuid";
import { captureState, type imageState } from "@/core/utils/getCapture";
import { extractActions, getActionRegistry } from "@/core/actionExtractor/extractActions";
import { decideNextAction, getAnswer } from "@/core/interpretation/decideNextAction";
import { executeAction } from "@/core/autoAction/executeAction";
import { getQuestions } from "@/core/charts/questions";
import { getImages } from "@/core/utils/getImages";

export function useAiRunner(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [isRunning, setIsRunning] = useState(false);

  async function runAI(params: {
    renderedChartId: ChartId | null;
    selectedChartId: ChartId | "";
    selectedQuestionIndex: number;
    maxStep: number;
  }) {
    const { renderedChartId, selectedChartId, selectedQuestionIndex, maxStep } = params;

    if (!renderedChartId) throw new Error("Please render a chart first.");
    if (!selectedChartId || renderedChartId !== selectedChartId) {
      throw new Error("Chart selection changed. Please click Render Chart first.");
    }

    const qs = getQuestions(renderedChartId);
    const questionText = qs[selectedQuestionIndex] ?? qs[0];
    if (!questionText) throw new Error("Please select a question.");

    setIsRunning(true);
    try {
      const container = containerRef.current;
      if (!container) throw new Error("chart container not found");

      const cap0 = uuidv4().split("-")[0];
      const before0: imageState | null = await captureState("before", cap0);
      if (!before0) throw new Error("Could not capture initial state");
      void getImages(before0, null);

      // await getChartType(container, img);
      const chartType = "tree";

      let step = 0;
      while (true) {
        const capId = uuidv4().split("-")[0];
        const before: imageState | null = await captureState("before", capId);
        if (!before) throw new Error("Could not capture state");

        await extractActions(step);
        const actionRegistry = getActionRegistry();

        const plan = await decideNextAction(chartType, questionText, before);
        const answer = getAnswer(plan);
        if (answer == null) break;

        const chosen = actionRegistry[answer.targetIndex];
        if (!chosen) break;

        await executeAction(chosen);
        if (answer.answerable === "YES") break;

        step++;
        if (step >= maxStep) break;
      }
    } finally {
      setIsRunning(false);
    }
  }

  return { isRunning, runAI };
}
