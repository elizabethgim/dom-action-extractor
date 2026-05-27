import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { captureState } from "@/core/utils/getCapture";
import { extractActions, getActionRegistry, setActionRegistry, resetExtractRegistries } from "@/core/actionExtractor/extractActions";
import { rankActionsApi } from "@/api/rankActionsApi";
import { addSemanticEntry, resetSemanticRegistry } from "@/core/actionExtractor/semanticRegistry";
import { clearActionIdIndex } from "@/core/actionExtractor/actionIdStore";
import { sendToAIPost } from "@/core/interpretation/sendToAI";
import { getImages } from "@/core/utils/getImages";
import { captureWithHighlight } from "@/core/utils/highlightElement";
import { executeAction } from "@/core/autoAction/executeAction";
import { decideNextAction, getAnswer } from "@core/interpretation/decideNextAction";
import { getEffectPrompt } from "@core/interpretation/getEffectPrompt";
import { getQuestions } from "@core/charts/questions";

import type { StepLog } from "@/core/models/types/aiRun/StepLog";
import type { StopReason } from "@core/models/types/aiRun/StopReason";
import type { imageState } from "@/core/models/interface/IimageState";


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
  const lastRunRenderVersionRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    stopFlagRef.current = false;
    setSteps([]);
    setStopReason(null);
    setLastError(null);
    setIsRunning(false);
    // 모듈-레벨 레지스트리 전부 초기화
    resetSemanticRegistry();
    resetExtractRegistries();
    clearActionIdIndex();
    lastRunRenderVersionRef.current = null;
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
    renderVersion?: number;
  }) => {
    setLastError(null);
    const { renderedChartId, selectedChartId, selectedQuestionIndex } = args;
    const chartType = args.chartType ?? "";
    const renderVersion = args.renderVersion ?? null;

    if (!selectedChartId || renderedChartId !== selectedChartId) {
      throw new Error("Chart selection changed. Please click Render Chart first.");
    }

    // 같은 render 버전으로 이미 run한 경우 → 차트를 다시 rendering해야 함
    if (
      renderVersion !== null &&
      lastRunRenderVersionRef.current !== null &&
      lastRunRenderVersionRef.current === renderVersion
    ) {
      throw new Error("Chart must be re-rendered before running again. Click 'Render Chart'.");
    }

    const container = containerRef.current;
    if (!container) throw new Error("chart container not found");

    const qs = getQuestions(renderedChartId);
    const fallback = (qs[selectedQuestionIndex] ?? qs[0] ?? "").trim();
    const question = (args.questionText?.trim() || fallback).trim();
    if (!question) throw new Error("Please select or type a question.");

    stopFlagRef.current = false;
    lastRunRenderVersionRef.current = renderVersion;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsRunning(true);
    setStopReason(null);
    setSteps([]);
    resetSemanticRegistry();

    try {
      let consecutiveNoAction = 0;
      let lastActionId: string | null = null;

      for (let step = 0; step < maxStep; step++) {
        if (stopFlagRef.current) {
          setStopReason("USER_STOP");
          break;
        }

        // 1) capture before
        const beforeCapId = uuidv4().split("-")[0];
        const before: imageState | null = await captureState("before", beforeCapId, container);
        if (!before) throw new Error("Could not capture state");

        // 2) extract actions
        await extractActions(step);
        if (controller.signal.aborted) { setStopReason("USER_STOP"); break; }

        const ranked = await rankActionsApi(question, getActionRegistry(), 30, controller.signal);
        if (controller.signal.aborted) { setStopReason("USER_STOP"); break; }
        setActionRegistry(ranked);
        
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
        
        if (!chosen || answer.targetIndex < 0) {
          consecutiveNoAction++;
          setSteps((prev) => markStop(prev, step, "NO_ACTION"));
          if (consecutiveNoAction >= 2) {
            setStopReason("NO_ACTION");
            break;
          }
          continue;
        }

        consecutiveNoAction = 0;

        const actionId = chosen.actionId;
        const selector = `[data-action-id="${actionId}"]`;

        if (actionId === lastActionId) {
          setSteps((prev) => markStop(prev, step, "REPEATED_ACTION"));
          setStopReason("REPEATED_ACTION");
          break;
        }
        lastActionId = actionId;

        setSteps((prev) =>
          patchStep(prev, step, {
            chosenAction: {
              actionId,
              selector,
              actionType: chosen.actionType,
            },
          })
        );

        // action 직전 캡처 — 대상 element 하이라이트 표시
        const beforeActionCapId = uuidv4().split("-")[0];
        const beforeAction: imageState | null = await captureWithHighlight(
          chosen.element,
          () => captureState("before", beforeActionCapId, container)
        );
        if (beforeAction) {
          setSteps((prev) => patchStep(prev, step, { beforeActionCapId, beforeAction }));
        }

        await executeAction(chosen);
        await new Promise((r) => setTimeout(r, 400)); // D3 transition 대기

        // action 직후 캡처
        const afterCapId = uuidv4().split("-")[0];
        const after: imageState | null = await captureState("after", afterCapId, container);
        if (after) {
          setSteps((prev) => patchStep(prev, step, { afterCapId, after }));

          const refImage = beforeAction ?? before;
          if (refImage.image === after.image) {
            // 시각적 변화 없음 → 즉시 기록
            addSemanticEntry(chosen, "no change");
          } else {
            // 변화 있음 → AI로 effect 분석 (fire-and-forget)
            const imgs = getImages(refImage, after);
            sendToAIPost({
              path: "/chat",
              prompt: getEffectPrompt(chosen.actionType),
              images: imgs,
            }).then((res) => {
              try {
                const raw = typeof res === "string" ? res : JSON.stringify(res);
                const parsed = JSON.parse(raw);
                if (parsed?.effect) addSemanticEntry(chosen, parsed.effect);
              } catch { /* ignore */ }
            }).catch(() => {});
          }
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