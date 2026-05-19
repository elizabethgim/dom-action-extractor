import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { captureState, type imageState } from "@/core/utils/getCapture";
import { extractActions, getActionRegistry } from "@/core/actionExtractor/extractActions";
import { executeAction } from "@/core/autoAction/executeAction";
import { decideNextAction, getAnswer } from "@core/interpretation/decideNextAction";
import { getQuestions } from "@core/charts/questions";

import type { StepLog } from "@/core/models/types/aiRun/StepLog";
import type { StopReason } from "@core/models/types/aiRun/StopReason";


type Params = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  maxStep: number;
};

export function useAiRunnerMachine({ containerRef, maxStep }: Params) {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<StepLog[]>([]);
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const stopFlagRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    stopFlagRef.current = false;
    setSteps([]);
    setStopReason(null);
    setLastError(null);
    setIsRunning(false);
  }, []);

  const stop = useCallback(() => {
    stopFlagRef.current = true;
    abortControllerRef.current?.abort();
  }, []);

  const run = useCallback(async (args: {
    renderedChartId: string | null;
    selectedChartId: string | "";
    selectedQuestionIndex: number;
    questionText?: string,
    chartType?: string;
  }) => {
    setLastError(null);
    const { renderedChartId, selectedChartId, selectedQuestionIndex } = args;
    const chartType = args.chartType ?? "";

    // if (!renderedChartId) throw new Error("Please render a chart first.");
    if (!selectedChartId || renderedChartId !== selectedChartId) {
      throw new Error("Chart selection changed. Please click Render Chart first.");
    }

    const container = containerRef.current;
    if (!container) throw new Error("chart container not found");

    const qs = getQuestions(renderedChartId);
    const fallback = (qs[selectedQuestionIndex] ?? qs[0] ?? "").trim();
    const question = (args.questionText?.trim() || fallback).trim();
    if (!question) throw new Error("Please select or type a question.");

    stopFlagRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);
    setStopReason(null);
    setSteps([]);

    try {
      for (let step = 0; step < maxStep; step++) {
        if (stopFlagRef.current) {
          setStopReason("USER_STOP");
          break;
        }

        // 1) capture before
        const beforeCapId = uuidv4().split("-")[0];
        const before: imageState | null = await captureState("before", beforeCapId);
        if (!before) throw new Error("Could not capture state");

        // 2) extract actions
        await extractActions(step);
        const actionRegistry = getActionRegistry();
        const actionCount = actionRegistry.length;

        // 3) decide next
        const plan = await decideNextAction(chartType, question, before, controller.signal);
        const answer = getAnswer(plan);
        const targetIndex = answer?.targetIndex ?? null;
        const answerable = answer?.answerable ?? null;

        // 미리 step log를 “중간 상태”로 UI에 추가 (즉시 보이게)
        const baseLog: StepLog = {
          step,
          question,
          chartType,
          beforeCapId,
          before,
          actionCount,
          planRaw: plan,
          targetIndex,
          answerable,
        };
        setSteps((prev) => [...prev, baseLog]);

        // 4) stop 조건들
        if (answer == null) {
          setSteps((prev) => markStop(prev, step, "NO_PLAN"));
          setStopReason("NO_PLAN");
          break;
        }
        const chosen = actionRegistry[answer.targetIndex];
        if (!chosen) {
          setSteps((prev) => markStop(prev, step, "NO_ACTION"));
          continue;
        }

        const actionId = chosen.actionId;
        const selector = `[data-action-id="${actionId}"]`;

        setSteps((prev) =>
          patchStep(prev, step, {
            chosenAction: {
              actionId,
              selector,
              actionType: chosen.actionType,
            },
          })
        );

        await executeAction(chosen);

        // 6) capture after (optional but 강추)
        const afterCapId = uuidv4().split("-")[0];
        const after: imageState | null = await captureState("after", afterCapId);
        if (after) {
          setSteps((prev) => patchStep(prev, step, { afterCapId, after }));
        }

        if (answer.answerable === "YES") {
          setSteps((prev) => markStop(prev, step, "ANSWERED"));
          setStopReason("ANSWERED");
          break;
        }

        // 계속 루프
        if (step === maxStep - 1) {
          setSteps((prev) => markStop(prev, step, "MAX_STEP"));
          setStopReason("MAX_STEP");
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStopReason("USER_STOP");
        return;
      }
      setLastError(String(e));
      setStopReason("ERROR");

      const msg = String(e);
      setSteps((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return patchStep(prev, last.step, { stopReason: "ERROR", error: msg });
      });

      throw e;
    } finally {
      setIsRunning(false);
    }
  }, [containerRef, maxStep]);

  return { isRunning, steps, stopReason, lastError, run, stop, reset };
}

// --- helpers ---
function patchStep(prev: StepLog[], step: number, patch: Partial<StepLog>) {
  return prev.map((s) => (s.step === step ? { ...s, ...patch } : s));
}
function markStop(prev: StepLog[], step: number, reason: StopReason) {
  return prev.map((s) => (s.step === step ? { ...s, stopReason: reason } : s));
}