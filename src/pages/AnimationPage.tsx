import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ResultPanel } from "@components/builder/ResultPanel";
import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { getAiRun } from "@/api/aiRunApi";

import type { StepLog } from "@/core/models/types/aiRun/StepLog";
import type { AiToAnimationState } from "@/types/navigationState";

import "@styles/global.css";

function formatTime(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString();
}

function stringify(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
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
        style={{ width: "100%", borderRadius: 8, border: "1px solid var(--color-border)", display: "block" }}
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
  const steps = activeState?.steps ?? [];
  const selectedStep = steps[selectedStepIndex];

  useEffect(() => {
    if (!activeState?.selectedChartId) return;
    if (renderedOnceRef.current === activeState.selectedChartId) return;

    renderedOnceRef.current = activeState.selectedChartId;
    const chartMeta = chartCatalog.find((c) => c.id === activeState.selectedChartId);
    if (!chartMeta) return;
    chartRender.renderChart(chartMeta).catch((e) => alert(String(e)));
  }, [activeState, chartRender]);

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

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Animation</h1>
          <p className="systemSubtitle">
            {activeState.source} / {activeState.family} / {activeChartTitle ?? activeState.selectedChartId}
            {activeState.runId ? ` / run ${activeState.runId}` : ""}
          </p>
          <button
            className="btn secondary"
            onClick={() => navigate("/ai", { state: activeState })}
          >
            ← Back to AI
          </button>
          <button
            className="btn secondary"
            onClick={() => navigate("/", { state: activeState })}
          >
            Home
          </button>
        </div>

        <section className="panel animationSection">
          <h1>Chart View</h1>
          <ResultPanel containerRef={resultContainerRef} />
        </section>
      </header>

      <section className="panel systemSection">
        <h1>AI Step Timeline</h1>
        {steps.length === 0 ? (
          <p className="muted">표현할 step이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {steps.map((step, index) => (
              <button
                key={step.step}
                className={index === selectedStepIndex ? "btn primary" : "btn secondary"}
                onClick={() => setSelectedStepIndex(index)}
              >
                Step {index + 1}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedStep ? (
        <>
          <section className="panel systemSection">
            <h1>Selected Step</h1>
            <div style={{ display: "grid", gap: 12 }}>
              <p>
                <strong>Question:</strong> {selectedStep.question}
              </p>
              <p>
                <strong>Target action index:</strong>{" "}
                {selectedStep.targetIndex ?? "none"} / {selectedStep.actionCount}
              </p>
              <p>
                <strong>Answerable:</strong> {selectedStep.answerable ?? "unknown"}
              </p>
              <p>
                <strong>Stop reason:</strong>{" "}
                {selectedStep.stopReason ?? activeState.stopReason ?? "running"}
              </p>
            </div>
          </section>

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
      ) : null}
    </div>
  );
}

export default AnimationPage;
