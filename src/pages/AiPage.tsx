import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { ChartPanel } from "@components/builder/ChartPanel";
import { ChartSelectPanel } from "@components/builder/ChartSelectPanel";
import { ResultPanel } from "@components/builder/ResultPanel";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useAiRunnerMachine } from "@hooks/useAiRunnerMachine";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { saveAiRun } from "@/services/aiRunApi";

import type { ChartId } from "@core/charts/chartRegistry";
import type { AiToAnimationState, SystemToAiState } from "./navigationState";

import "@styles/global.css";

function stringifyStepValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function AiPage() {
  const maxStep = 7;
  const location = useLocation();
  const navigate = useNavigate();
  const initialState = location.state as SystemToAiState | null;
  const autoRenderedChartRef = useRef<ChartId | null>(null);
  const savedStepsLengthRef = useRef(0);

  const { charts: chartCatalog, isLoadingCharts, chartCatalogError } =
    useChartCatalog();

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const resultContainerRef = useRef<HTMLDivElement | null>(null);

  const filters = useChartFilters(chartCatalog);

  const viewRender = useChartRenderer(chartContainerRef);
  const mainRender = useChartRenderer(resultContainerRef);

  const {
    isRunning,
    steps,
    stopReason,
    lastError,
    run,
    stop,
    reset,
  } = useAiRunnerMachine({
    containerRef: resultContainerRef,
    maxStep,
  });

  const [customQuestion, setCustomQuestion] = useState("");
  const [savedRunId, setSavedRunId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = customQuestion.trim() || presetQuestion;

  const selectedChartId = filters.selectedChartId as ChartId;

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

    const id = filters.selectedChartId as ChartId;
    autoRenderedChartRef.current = id;
    viewRender.renderChart(id).catch((e) => alert(String(e)));
    mainRender.renderChart(id).catch((e) => alert(String(e)));
  }, [filters.selectedChartId, mainRender, viewRender]);

  const goToAnimationPage = (selectedStepIndex: number) => {
    if (!filters.source || !filters.family || !filters.selectedChartId) return;

    const state: AiToAnimationState = {
      source: filters.source,
      family: filters.family,
      selectedChartId: filters.selectedChartId as ChartId,
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
      chartId: filters.selectedChartId as ChartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
      stopReason,
      steps,
    })
      .then((run) => {
        setSavedRunId(run.id);
      })
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

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>AI Step Debugger</h1>
          {initialState ? (
            <p className="systemSubtitle">
              {initialState.source} / {initialState.family} / {initialState.selectedChartId}
            </p>
          ) : null}
        </div>

        <ChartSelectPanel
          source={filters.source}
          setSource={filters.setSource}
          family={filters.family}
          setFamily={filters.setFamily}
          selectedChartId={filters.selectedChartId}
          setSelectedChartId={filters.setSelectedChartId}
          sources={filters.sources}
          families={filters.families}
          charts={filters.charts}
          isLoadingCharts={isLoadingCharts}
          chartCatalogError={chartCatalogError}
          onRender={() => {
            if (!filters.selectedChartId) return;

            viewRender.renderChart(selectedChartId).catch((e) => alert(String(e)));
            mainRender.renderChart(selectedChartId).catch((e) => alert(String(e)));
          }}
          renderedChartId={viewRender.renderedChartId}
          isRunning={isRunning}
          isRendering={viewRender.isRendering || mainRender.isRendering}
          onSourceChanged={() => {
            if (isRunning) stop();

            viewRender.resetRendered();
            mainRender.resetRendered();

            filters.setSelectedChartId("");
            filters.setSelectedQuestionIndex(0);
            reset();
          }}
        />

        <section className="panel chartView">
          <ChartPanel
            containerRef={chartContainerRef}
            hasChart={Boolean(viewRender.renderedChartId)}
            isRendering={viewRender.isRendering}
            overlay={null}
          />
        </section>
      </header>

      <section className="panel systemSection">
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ fontWeight: 700 }}>Question</label>

          <input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder={presetQuestion || "Type a question..."}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e5e5",
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
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
          {savedRunId ? <p className="muted">Saved run ID: {savedRunId}</p> : null}
          {lastError && <p style={{ color: "crimson" }}>{lastError}</p>}
          {saveError && <p style={{ color: "crimson" }}>Save error: {saveError}</p>}
        </div>
      </section>

      <section className="panel animationSection">
        <h1>Execution View</h1>

        <ResultPanel containerRef={resultContainerRef} />
      </section>

      <section className="panel systemSection">
        <h1>AI Intermediate Responses</h1>

        {steps.length === 0 ? (
          <p className="muted">No steps</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {steps.map((step, index) => (
              <article
                key={index}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <h3>Step {index + 1}</h3>
                  <button className="btn secondary" onClick={() => goToAnimationPage(index)}>
                    Show Animation
                  </button>
                </div>

                <div>
                  <strong>Question</strong>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {step.question}
                  </pre>
                </div>

                <div>
                  <strong>AI Raw Response</strong>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {stringifyStepValue(step.planRaw)}
                  </pre>
                </div>

                <div>
                  <strong>Parsed Action</strong>
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(
                      {
                        targetIndex: step.targetIndex,
                        answerable: step.answerable,
                        actionCount: step.actionCount,
                        stopReason: step.stopReason,
                        error: step.error,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default AiPage;
