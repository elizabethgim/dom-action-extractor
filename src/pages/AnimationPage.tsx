import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { getAiRun } from "@/api/aiRunApi";
import { extractActions, getActionRegistry } from "@/core/actionExtractor/extractActions";
import { executeAction } from "@/core/autoAction/executeAction";

import type { StepLog } from "@/core/models/types/aiRun/StepLog";
import type { IActions } from "@/core/models/interface/IActions";
import type { AiToAnimationState } from "@/types/navigationState";

import "@styles/global.css";
import "@styles/AnimationPage.css";
import "@styles/ChartPanel.css";

function formatTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString();
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parsePlan(planRaw: unknown): { reason?: string; answer?: string } {
  try {
    const obj = typeof planRaw === "string" ? JSON.parse(planRaw) : planRaw;
    return obj ?? {};
  } catch { return {}; }
}

function CapturePreview({ title, step }: { title: string; step?: StepLog["before"] }) {
  if (!step) {
    return (
      <div>
        <p className="stepLabel" style={{ marginBottom: 6 }}>{title}</p>
        <p className="muted">No capture</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <p className="stepLabel">{title}</p>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{formatTime(step.timestamp)}</span>
      </div>
      <img
        src={step.image}
        alt={`${title} capture`}
        className="captureImage"
      />
    </div>
  );
}

function AnimationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = location.state as AiToAnimationState | null;
  const queryRunId = searchParams.get("runId") ?? state?.runId ?? null;
  const queryStepIndex = Number(searchParams.get("step") ?? state?.selectedStepIndex ?? 0);

  const { charts: chartCatalog } = useChartCatalog();
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const renderedOnceRef = useRef<string | null>(null);
  const chartRender = useChartRenderer(resultContainerRef);

  const [dbState, setDbState] = useState<AiToAnimationState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(queryStepIndex);

  const [liveRegistry, setLiveRegistry] = useState<IActions[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayingStep, setReplayingStep] = useState<number | null>(null);
  const stopPlayRef = useRef(false);

  useEffect(() => {
    setSelectedStepIndex(queryStepIndex);
  }, [queryStepIndex]);

  useEffect(() => {
    if (!queryRunId) return;

    setLoadError(null);
    getAiRun(queryRunId)
      .then((run) => {
        setDbState({
          source: run.source,
          family: run.family,
          selectedChartId: run.chartId,
          selectedQuestionIndex: run.selectedQuestionIndex,
          questionText: run.questionText,
          runId: run.id,
          steps: run.steps,
          selectedStepIndex: queryStepIndex,
          stopReason: run.stopReason,
        });
      })
      .catch((error) => setLoadError(String(error)));
  }, [queryRunId, queryStepIndex]);

  const activeState = dbState ?? state;
  const activeChartTitle = chartCatalog.find((c) => c.id === activeState?.selectedChartId)?.title;
  const steps = useMemo(() => activeState?.steps ?? [], [activeState]);
  const selectedStep = steps[selectedStepIndex];

  useEffect(() => {
    if (!activeState?.selectedChartId) return;
    if (renderedOnceRef.current === activeState.selectedChartId) return;

    const chartMeta = chartCatalog.find((c) => c.id === activeState.selectedChartId);
    if (!chartMeta) return; // chartCatalog 로드 전이면 아직 renderedOnceRef 세팅 안 함

    renderedOnceRef.current = activeState.selectedChartId;
    chartRender.renderChart(chartMeta).catch((e) => alert(String(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState?.selectedChartId, chartCatalog]);

  // Extract live action registry after chart renders
  useEffect(() => {
    if (!chartRender.renderedChartId) return;
    extractActions(0).then(() => {
      setLiveRegistry([...getActionRegistry()]);
    });
  }, [chartRender.renderedChartId, chartRender.renderVersion]);

  // Find a live IActions entry matching a recorded chosenAction
  const findAction = useCallback(
    (chosen: NonNullable<StepLog["chosenAction"]>): IActions | null => {
      // 1. datum name match (most reliable for D3)
      if (chosen.datumName) {
        const match = liveRegistry.find(
          (a) =>
            a.actionType === chosen.actionType &&
            a.datum?.name != null &&
            String(a.datum.name) === chosen.datumName
        );
        if (match) return match;
      }
      // 2. text content match
      const text = chosen.text;
      if (text) {
        const match = liveRegistry.find(
          (a) =>
            a.actionType === chosen.actionType &&
            (a.text?.trim() || "") === text.trim()
        );
        if (match) return match;
      }
      // 3. CSS selector match — synthesize minimal IActions from the DOM element
      if (chosen.selector) {
        const el = resultContainerRef.current?.querySelector(chosen.selector);
        if (el) {
          const found = liveRegistry.find(
            (a) => a.element === el && a.actionType === chosen.actionType
          );
          if (found) return found;
          return {
            actionId: chosen.actionId,
            actionType: chosen.actionType as "click" | "hover" | "zoom",
            eventType: chosen.actionType === "hover" ? "mouseenter" : chosen.actionType,
            element: el,
            elementInfo: {
              id: el.id,
              className: el.getAttribute("class") ?? "",
              innerHTML: "",
            },
            datum: null,
          } as IActions;
        }
      }
      return null;
    },
    [liveRegistry]
  );

  const replayOne = useCallback(
    async (index: number) => {
      const step = steps[index];
      if (!step?.chosenAction) return;
      const action = findAction(step.chosenAction);
      if (!action) {
        console.warn("Animation: no matching element for step", index, step.chosenAction);
        return;
      }
      setSelectedStepIndex(index);
      setReplayingStep(index);
      try {
        await executeAction(action);
      } finally {
        setReplayingStep(null);
      }
    },
    [steps, findAction]
  );

  const startAutoPlay = useCallback(async () => {
    stopPlayRef.current = false;
    setIsPlaying(true);
    try {
      for (let i = 0; i < steps.length; i++) {
        if (stopPlayRef.current) break;
        const step = steps[i];
        if (step.chosenAction) {
          await replayOne(i);
          if (stopPlayRef.current) break;
          await new Promise<void>((r) => setTimeout(r, 1500));
        } else {
          setSelectedStepIndex(i);
          await new Promise<void>((r) => setTimeout(r, 800));
        }
      }
    } finally {
      setIsPlaying(false);
    }
  }, [steps, replayOne]);

  const stopAutoPlay = useCallback(() => {
    stopPlayRef.current = true;
  }, []);

  const resetChart = useCallback(async () => {
    const chartMeta = chartCatalog.find((c) => c.id === activeState?.selectedChartId);
    if (!chartMeta) return;
    renderedOnceRef.current = null;
    renderedOnceRef.current = activeState!.selectedChartId;
    await chartRender.renderChart(chartMeta);
  }, [chartCatalog, activeState, chartRender]);

  if (!activeState) {
    return (
      <div className="systemPage">
        <section className="panel systemSection">
          <h1>Animation</h1>
          <p className="muted">
            {loadError ?? "전달된 AI 실행 결과가 없습니다."}
          </p>
          <button className="btn primary" onClick={() => navigate("/system")}>
            Go to System
          </button>
        </section>
      </div>
    );
  }

  const hasLiveRegistry = liveRegistry.length > 0;
  const isReplaying = replayingStep !== null || isPlaying;

  return (
    <div className="systemPage">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="systemHeader">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div className="systemTitle">
            <h1>Animation</h1>
            <p className="systemSubtitle">
              {activeState.source} / {activeState.family} / {activeChartTitle ?? activeState.selectedChartId}
              {activeState.runId ? ` / run ${activeState.runId}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <button className="btn secondary" onClick={() => navigate("/ai", { state: activeState })}>
              ← Back to AI
            </button>
            <button className="btn secondary" onClick={() => navigate("/", { state: activeState })}>
              Home
            </button>
          </div>
        </div>
      </header>

      {/* ── Q&A panel ───────────────────────────────────────── */}
      {activeState.questionText && (() => {
        const answeredStep = [...steps].reverse().find((s: StepLog) => s.answerable === "YES");
        const parsed = answeredStep ? parsePlan(answeredStep.planRaw) : null;
        const answer = parsed?.answer ?? parsed?.reason ?? null;
        return (
          <section className="panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", minWidth: 16 }}>Q</span>
              <p style={{ margin: 0, fontSize: 14 }}>{activeState.questionText}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-brand)", minWidth: 16 }}>A</span>
              <p style={{ margin: 0, fontSize: 14, color: answer ? "var(--color-text)" : "var(--color-text-muted)" }}>
                {answer ?? "No answer yet."}
              </p>
            </div>
          </section>
        );
      })()}

      {/* ── Main 2-column: Chart | Controls ─────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>
        {/* Left: live chart */}
        <section className="panel" style={{ minHeight: 400 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h1 style={{ margin: 0 }}>Chart View</h1>
            <button
              className="btn secondary"
              onClick={resetChart}
              disabled={isReplaying}
              title="차트를 초기 상태로 리셋"
              style={{ fontSize: 13 }}
            >
              ↺ Reset
            </button>
          </div>
          <div ref={resultContainerRef} className="chartResult" />
        </section>

        {/* Right: step timeline + step detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Step timeline */}
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h1 style={{ margin: 0, fontSize: 14 }}>Steps</h1>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {!hasLiveRegistry && (
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>렌더 대기…</span>
                )}
                {isPlaying ? (
                  <button className="btn primary" onClick={stopAutoPlay} style={{ fontSize: 12, padding: "4px 12px" }}>
                    ⏹ Stop
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={startAutoPlay}
                    disabled={steps.length === 0 || !hasLiveRegistry}
                    style={{ fontSize: 12, padding: "4px 12px" }}
                  >
                    ▶▶ Auto-play
                  </button>
                )}
              </div>
            </div>
            {steps.length === 0 ? (
              <p className="muted">표현할 step이 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {steps.map((step, index) => (
                  <div
                    key={step.step}
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: index === selectedStepIndex
                        ? "var(--color-brand-ghost)"
                        : "transparent",
                      border: index === selectedStepIndex
                        ? "1px solid var(--color-brand)"
                        : "1px solid transparent",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() => setSelectedStepIndex(index)}
                  >
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: index === selectedStepIndex ? "var(--color-brand)" : "var(--color-text-muted)",
                      minWidth: 52,
                    }}>
                      Step {index + 1}
                    </span>
                    {step.chosenAction && (
                      <span style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {step.chosenAction.actionType}
                        {step.chosenAction.datumName ? ` · ${step.chosenAction.datumName}` : ""}
                      </span>
                    )}
                    {step.chosenAction && (
                      <button
                        className="btn secondary"
                        onClick={(e) => { e.stopPropagation(); replayOne(index); }}
                        disabled={isReplaying || !hasLiveRegistry}
                        title={`Replay: ${step.chosenAction.actionType}`}
                        style={{ padding: "2px 8px", fontSize: 11, minWidth: 26 }}
                      >
                        {replayingStep === index ? "…" : "▶"}
                      </button>
                    )}
                    {step.stopReason && (
                      <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
                        {step.stopReason}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Selected step detail */}
          {selectedStep && (
            <section className="panel">
              <h1 style={{ marginBottom: 12, fontSize: 14 }}>Step {selectedStepIndex + 1} Detail</h1>
              <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
                {parsePlan(selectedStep.planRaw).reason && (
                  <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
                    {parsePlan(selectedStep.planRaw).reason}
                  </p>
                )}
                {selectedStep.chosenAction && (
                  <p style={{ margin: 0 }}>
                    <strong>Action:</strong>{" "}
                    <code style={{ fontSize: 12 }}>{selectedStep.chosenAction.actionType}</code>
                    {selectedStep.chosenAction.datumName
                      ? ` → ${selectedStep.chosenAction.datumName}`
                      : selectedStep.chosenAction.text
                      ? ` → "${selectedStep.chosenAction.text}"`
                      : ""}
                  </p>
                )}
                <p style={{ margin: 0 }}>
                  <strong>Actions found:</strong> {selectedStep.actionCount}
                  {selectedStep.targetIndex != null ? ` · index ${selectedStep.targetIndex}` : ""}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Answerable:</strong> {selectedStep.answerable ?? "unknown"}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Stop:</strong>{" "}
                  {selectedStep.stopReason ?? activeState.stopReason ?? "—"}
                </p>
              </div>
            </section>
          )}
        </div>
      </div>

      {/* ── Before / After captures ──────────────────────────── */}
      {selectedStep && (
        <>
          <section className="panel systemSection">
            <h1>Before / After</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 24 }}>
              <CapturePreview title="Before" step={selectedStep.beforeAction ?? selectedStep.before} />
              <CapturePreview title="After" step={selectedStep.after} />
            </div>
          </section>

          <section className="panel systemSection">
            <h1>AI Raw Response</h1>
            <pre className="rawResponse">{stringify(selectedStep.planRaw)}</pre>
          </section>
        </>
      )}
    </div>
  );
}

export default AnimationPage;
