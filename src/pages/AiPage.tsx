import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ResultPanel } from "@components/builder/ResultPanel";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useAiRunnerMachine } from "@hooks/useAiRunnerMachine";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { saveAiRun } from "@/api/aiRunApi";

import type { AiToAnimationState, SystemToAiState } from "@/types/navigationState";

import "@styles/global.css";
import "@styles/AIPage.css";

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

  const { isRunning, steps, stopReason, lastError, run, stop, reset } = useAiRunnerMachine({
    containerRef: resultContainerRef,
    maxStep,
  });

  const [customQuestion, setCustomQuestion] = useState("");
  const [savedRunId, setSavedRunId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = customQuestion.trim() || presetQuestion;

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
    saveAiRun({
      source: filters.source,
      family: filters.family,
      chartId: filters.selectedChartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
      stopReason,
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
    isRunning,
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

          {stopReason && <p className="muted">Stop reason: {stopReason}</p>}
          {savedRunId && <p className="muted">Saved run: {savedRunId}</p>}
          {lastError && <p className="error-text">{lastError}</p>}
          {saveError && <p className="error-text">Save error: {saveError}</p>}
        </div>
      </section>

      <section className="panel animationSection">
        <h1>Execution View</h1>
        <ResultPanel containerRef={resultContainerRef} />
      </section>

      <section className="panel systemSection">
        <h1>AI Steps</h1>
        {steps.length === 0 ? (
          <p className="muted">No steps yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 20 }}>
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
                  <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--color-text-muted)" }}>
                    {plan.type && <span>Action: <strong style={{ color: "var(--color-text)" }}>{plan.type}</strong></span>}
                    {step.targetIndex != null && <span>Index: <strong style={{ color: "var(--color-text)" }}>{step.targetIndex}</strong> / {step.actionCount}</span>}
                    <span>Answerable: <strong style={{ color: "var(--color-text)" }}>{step.answerable ?? "?"}</strong></span>
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
