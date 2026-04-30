import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";

import { ResultPanel } from "@components/builder/ResultPanel";
import { useChartRenderer } from "@hooks/useChartRenderer";
import { getAiRun } from "@/services/aiRunApi";

import type { ChartId } from "@core/charts/chartRegistry";
import type { StepLog } from "@core/models/types/aiRun";
import type { AiToAnimationState } from "./navigationState";

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
      <div className="panel panel--tight">
        <h3>{title}</h3>
        <p className="muted">No capture</p>
      </div>
    );
  }

  return (
    <div className="panel panel--tight">
      <h3>{title}</h3>
      <p className="muted">{formatTime(step.timestamp)}</p>
      <img
        src={step.image}
        alt={`${title} capture`}
        style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8 }}
      />
    </div>
  );
}

function AnimationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = location.state as AiToAnimationState | null;
  const queryRunId = Number(searchParams.get("runId") ?? state?.runId ?? 0) || null;
  const queryStepIndex = Number(searchParams.get("step") ?? state?.selectedStepIndex ?? 0);

  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const renderedOnceRef = useRef<ChartId | null>(null);
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
  const steps = activeState?.steps ?? [];
  const selectedStep = steps[selectedStepIndex];

  useEffect(() => {
    if (!activeState?.selectedChartId) return;
    if (renderedOnceRef.current === activeState.selectedChartId) return;

    renderedOnceRef.current = activeState.selectedChartId;
    chartRender.renderChart(activeState.selectedChartId).catch((e) => alert(String(e)));
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
            {activeState.source} / {activeState.family} / {activeState.selectedChartId}
            {activeState.runId ? ` / run ${activeState.runId}` : ""}
          </p>
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

          <section
            className="systemSection"
            style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}
          >
            <CapturePreview title="Before" step={selectedStep.before} />
            <CapturePreview title="After" step={selectedStep.after} />
          </section>

          <section className="panel systemSection">
            <h1>AI Raw Response</h1>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                padding: 16,
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
              }}
            >
              {stringify(selectedStep.planRaw)}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}

export default AnimationPage;
