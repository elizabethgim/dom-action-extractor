import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";


import { useChartRenderer } from "@hooks/useChartRenderer";
import { useAiRunnerMachine } from "@hooks/useAiRunnerMachine";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { saveAiRun } from "@/api/aiRunApi";
import { findExpectedAnswer } from "@/core/grading/answerKey";
import { gradeAnswer, GRADE_LABEL, GRADE_COLOR } from "@/core/grading/grade";

import type { AiToAnimationState, SystemToAiState } from "@/types/navigationState";

import "@styles/global.css";
import "@styles/AIPage.css";
import "@styles/ChartPanel.css";

function stringifyStepValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parsePlan(planRaw: unknown): { reason?: string; answerable?: string; type?: string; targetIndex?: number } {
  try {
    const obj = typeof planRaw === "string" ? JSON.parse(planRaw) : planRaw;
    return obj ?? {};
  } catch { return {}; }
}

function StopBadge({ reason }: { reason?: string }) {
  if (!reason) return null;

  const color: Record<string, string> = {
    ANSWERED: "#16a34a", 
    NO_PLAN: "#dc2626", 
    NO_ACTION: "#d97706",
    REPEATED_ACTION: "#d97706", 
    MAX_STEP: "#6b7280", 
    USER_STOP: "#6b7280", 
    ERROR: "#dc2626",
  };

  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 10, fontWeight: 600,
      background: `${color[reason] ?? "#6b7280"}22`,
      color: color[reason] ?? "#6b7280",
      border: `1px solid ${color[reason] ?? "#6b7280"}44`,
    }}>
      {reason}
    </span>
  );
}

function AiPage() {
  const maxStep = 7;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stateFromUrl: SystemToAiState | null = (() => {
    const chartId = searchParams.get("chartId");
    const questionIndex = searchParams.get("questionIndex");
    const question = searchParams.get("question");
    if (!chartId) return null;
    return {
      source: "",
      family: "",
      selectedChartId: chartId,
      selectedQuestionIndex: Number(questionIndex ?? 0),
      questionText: question ?? "",
    };
  })();

  const initialState = (location.state as SystemToAiState | null) ?? stateFromUrl;
  const autoRenderedChartRef = useRef<string | null>(null);
  const savedStepsLengthRef = useRef(0);

  const { charts: chartCatalog } = useChartCatalog();
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const filters = useChartFilters(chartCatalog);
  const mainRender = useChartRenderer(resultContainerRef);

  const { isRunning, steps, stopReason, lastError, finalAnswer, run, stop, reset, initSteps } = useAiRunnerMachine({
    containerRef: resultContainerRef,
    maxStep,
  });

  const [customQuestion, setCustomQuestion] = useState("");
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [useRanking, setUseRanking] = useState(() => searchParams.get("variant") === "ranked");
  const pipelineVariant = useRanking ? "ranked" : "baseline";

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = customQuestion.trim() || presetQuestion;

  // AnimationPage에서 돌아올 때 steps/runId 복원
  useEffect(() => {
    const s = location.state as AiToAnimationState | null;
    if (!s?.steps?.length) return;
    initSteps(s.steps, (s.stopReason ?? null) as Parameters<typeof initSteps>[1]);
    if (s.runId) {
      setSavedRunId(s.runId);
      savedStepsLengthRef.current = s.steps.length;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSavedRunId(null);
    setSaveError(null);
    savedStepsLengthRef.current = 0;
  }, [filters.selectedChartId, effectiveQuestion]);

  useEffect(() => {
    if (!initialState || chartCatalog.length === 0) return;
    const chart = chartCatalog.find((item) => item.id === initialState.selectedChartId);
    if (!chart) return;
    filters.setSource(chart.source);
    filters.setFamily(chart.family);
    filters.setSelectedQuestionIndex(initialState.selectedQuestionIndex);
    setCustomQuestion(initialState.questionText);
  }, [chartCatalog, initialState]);

  useEffect(() => {
    if (!initialState) return;
    if (!filters.charts.some((chart) => chart.id === initialState.selectedChartId)) return;
    filters.setSelectedChartId(initialState.selectedChartId);
  }, [filters.charts, initialState]);

  useEffect(() => {
    if (!filters.selectedChartId) return;
    if (autoRenderedChartRef.current === filters.selectedChartId) return;
    const id = filters.selectedChartId;
    autoRenderedChartRef.current = id;
    const chartMeta = chartCatalog.find((c) => c.id === id);
    if (!chartMeta) return;
    mainRender.renderChart(chartMeta).catch((e) => alert(String(e)));
  }, [filters.selectedChartId, mainRender]);

  const goToAnimationPage = (selectedStepIndex: number) => {
    if (!filters.source || !filters.family || !filters.selectedChartId) return;
    const state: AiToAnimationState = {
      source: filters.source,
      family: filters.family,
      selectedChartId: filters.selectedChartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
      runId: savedRunId ?? undefined,
      steps,
      selectedStepIndex,
      stopReason,
    };
    const query = savedRunId
      ? `?runId=${savedRunId}&step=${selectedStepIndex}`
      : `?step=${selectedStepIndex}`;
    navigate(`/animation${query}`, { state });
  };

  useEffect(() => {
    if (isRunning || !stopReason || steps.length === 0 || !filters.selectedChartId) return;
    if (savedStepsLengthRef.current === steps.length) return;
    savedStepsLengthRef.current = steps.length;
    setSaveError(null);
    const expectedAnswer = findExpectedAnswer(effectiveQuestion);
    const grade = stopReason === "ANSWERED" ? gradeAnswer(finalAnswer, expectedAnswer) : null;
    saveAiRun({
      source: filters.source,
      family: filters.family,
      chartId: filters.selectedChartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
      stopReason,
      expectedAnswer,
      grade,
      pipelineVariant,
      steps,
    })
      .then((run) => setSavedRunId(run.id))
      .catch((error) => {
        savedStepsLengthRef.current = 0;
        setSaveError(String(error));
      });
  }, [
    effectiveQuestion,
    filters.family,
    filters.selectedChartId,
    filters.selectedQuestionIndex,
    filters.source,
    finalAnswer,
    isRunning,
    pipelineVariant,
    steps,
    stopReason,
  ]);

  const chartTitle = chartCatalog.find((c) => c.id === initialState?.selectedChartId)?.title;

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>AI Step Tracker</h1>
          {initialState ? (
            <p className="systemSubtitle">
              {initialState.source} / {initialState.family} /{" "}
              {chartTitle ?? initialState.selectedChartId}
            </p>
          ) : null}
        </div>
        <div>
          <button
            className="btn primary"
            onClick={() => navigate("/")}
          >
            Back
          </button>
        </div>
        
      </header>

      <section className="panel systemSection">
        <h1>Question</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder={presetQuestion || "Type a question..."}
          />

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={useRanking}
              disabled={isRunning}
              onChange={(e) => setUseRanking(e.target.checked)}
            />
            Use ranking model (sentence-transformers pre-filter)
          </label>

          <div className="controlBox" style={{ display: "flex", gap: 8 }}>
            <button
              className="btn primary"
              disabled={isRunning || !filters.selectedChartId}
              onClick={() => {
                run({
                  renderedChartId: mainRender.renderedChartId,
                  selectedChartId: filters.selectedChartId,
                  selectedQuestionIndex: filters.selectedQuestionIndex,
                  questionText: effectiveQuestion,
                  chartType: "",
                  renderVersion: mainRender.renderVersion,
                  useRanking,
                }).catch((e) => alert(String(e)));
              }}
            >
              {isRunning ? "Running..." : "Run AI"}
            </button>

            <button className="btn secondary" disabled={!isRunning} onClick={stop}>
              Stop
            </button>

            <button className="btn secondary" onClick={reset}>
              Reset
            </button>
          </div>

          {stopReason && <p className="muted">Stop reason: {stopReason} · Pipeline: {pipelineVariant}</p>}
          {stopReason === "ANSWERED" && finalAnswer && (() => {
            const expected = findExpectedAnswer(effectiveQuestion);
            const grade = gradeAnswer(finalAnswer, expected);
            return (
              <p className="muted">
                Grade: <strong style={{ color: GRADE_COLOR[grade] }}>{GRADE_LABEL[grade]}</strong>
                {expected && <> — expected: <em>{expected}</em></>}
              </p>
            );
          })()}
          {savedRunId && <p className="muted">Saved run: {savedRunId}</p>}
          {lastError && (
            <p className="error-text">
              {lastError}
              {lastError.includes("re-rendered") && (
                <button
                  className="btn primary"
                  style={{ marginLeft: 10, fontSize: 12, padding: "2px 10px" }}
                  disabled={mainRender.isRendering}
                  onClick={() => {
                    const chartMeta = chartCatalog.find((c) => c.id === filters.selectedChartId);
                    if (!chartMeta) return;
                    reset();
                    mainRender.renderChart(chartMeta).catch((e) => alert(String(e)));
                  }}
                >
                  Render Now
                </button>
              )}
            </p>
          )}
          {saveError && <p className="error-text">Save error: {saveError}</p>}
        </div>
      </section>

      <section className="panel animationSection">
        <h1>Execution View</h1>
        <div ref={resultContainerRef} className="chartResult" />
      </section>

      <section className="panel systemSection">
        <h1>AI Steps</h1>
        {steps.length === 0 ? (
          <p className="muted">No steps yet.</p>
        ) : (
          <div className="stepList" style={{ display: "grid", gap: 20 }}>
            {steps.map((step, index) => {
              const plan = parsePlan(step.planRaw);
              const beforeImg = step.beforeAction ?? step.before;
              return (
                <article key={index} className="stepCard">
                  {/* header */}
                  <div className="stepCardHeader">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3>Step {index + 1}</h3>
                      <StopBadge reason={step.stopReason} />
                    </div>
                    <button className="btn secondary" onClick={() => goToAnimationPage(index)}>
                      Show Animation
                    </button>
                  </div>

                  {/* before / after */}
                  <div className="captureBox">
                    <div key="Before">
                      <p className="stepLabel">Before</p>
                      {beforeImg
                      ? <img className="captureImage" src={beforeImg.image} alt="Before" />
                      : <div className="captureEmpty">No Capture</div>}
                    </div>
                    <div key="After">
                      <p className="stepLabel">After</p>
                      {step.after
                      ? <img className="captureImage" src={step.after.image} alt="After" />
                      : <div className="captureEmpty">No Capture</div>}
                    </div>
                  </div>

                  {/* reason */}
                  {plan.reason && (
                    <div>
                      <p className="stepLabel" style={{ marginBottom: 4 }}>Reason</p>
                      <p style={{ fontSize: 13, margin: 0 }}>{plan.reason}</p>
                    </div>
                  )}

                  {/* action summary */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: "var(--color-text-muted)" }}>
                    {step.model && <span>Model: <strong style={{ color: "var(--color-text)" }}>{step.model}</strong></span>}
                    {plan.type && <span>Action: <strong style={{ color: "var(--color-text)" }}>{plan.type}</strong></span>}
                    {step.targetIndex != null && <span>Index: <strong style={{ color: "var(--color-text)" }}>{step.targetIndex}</strong> / {step.actionCount}</span>}
                    {step.chosenAction?.datumName && (
                      <span>Datum: <strong style={{ color: "var(--color-text)" }}>{step.chosenAction.datumName}</strong></span>
                    )}
                    {step.chosenAction?.text && !step.chosenAction?.datumName && (
                      <span>Text: <strong style={{ color: "var(--color-text)" }}>{step.chosenAction.text}</strong></span>
                    )}
                    {step.chosenAction?.selector && (
                      <span style={{ fontFamily: "monospace", fontSize: 11 }}>{step.chosenAction.selector}</span>
                    )}
                    <span>Answerable: <strong style={{ color: "var(--color-text)" }}>{step.answerable ?? "?"}</strong></span>
                    {step.decideMs != null && <span>Decide time: <strong style={{ color: "var(--color-text)" }}>{step.decideMs}ms</strong></span>}
                    {step.effectMs != null && <span>Effect time: <strong style={{ color: "var(--color-text)" }}>{step.effectMs}ms</strong></span>}
                  </div>

                  {/* raw */}
                  <details>
                    <summary style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>Raw response</summary>
                    <pre className="rawResponse" style={{ marginTop: 6 }}>{stringifyStepValue(step.planRaw)}</pre>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default AiPage;
