import { useEffect, useMemo, useRef, useState } from "react";

import { ChartPanel } from "@components/builder/ChartPanel";
import { useChartRenderer } from "@hooks/useChartRenderer";
import { useAiRunnerMachine } from "@hooks/useAiRunnerMachine";
import { useChartCatalog } from "@/hooks/useChartMeta";
import { embedOwidData } from "@/core/prompts/owid_prompt";
import { extractActions, getActionRegistry } from "@/core/actionExtractor/extractActions";
import { executeAction } from "@/core/autoAction/executeAction";
import { chartRegistry } from "@/core/charts/chartRegistry";
import { findLiveAction, getElementBoxInContainer, getCueLabel } from "@/core/utils/animationCue";
import { findExpectedAnswer } from "@/core/grading/answerKey";
import { gradeAnswer, GRADE_LABEL, GRADE_COLOR, type GradeResult } from "@/core/grading/grade";
import { saveAiRun } from "@/api/aiRunApi";

import type { StepLog } from "@/core/models/types/aiRun/StepLog";
import type { IActions } from "@/core/models/interface/IActions";
import type { AnimationCue } from "@/types/AnimationCues";
import type { ChartMetadata } from "@/core/models/types/ChartMetadata";

import "@styles/global.css";
import "@styles/AIPage.css";
import "@styles/AnimationPage.css";
import "@styles/OurWorldDataPage.css";

const MAX_STEP = 7;

function titleFromOwidSlug(slug: string): string {
  const words = slug
    .replace(/^owid:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");

  return words
    .map((word) => {
      if (word.toLowerCase() === "gdp") return "GDP";
      if (word.toLowerCase() === "co2") return "CO2";
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const localOwidCharts: ChartMetadata[] = Object.keys(chartRegistry)
  .filter((slug) => slug.startsWith("owid:"))
  .map((slug) => ({
    id: slug,
    slug,
    title: titleFromOwidSlug(slug),
    source: "ourworldindata",
    family: "dashboard",
    renderer: "d3",
    description: "Local Our World in Data dashboard script.",
    dataset_id: null,
    questions: [],
  }));

function mergeOwidCharts(remoteCharts: ChartMetadata[]): ChartMetadata[] {
  const bySlug = new Map<string, ChartMetadata>();

  for (const chart of localOwidCharts) bySlug.set(chart.slug, chart);
  for (const chart of remoteCharts) {
    if (chart.source === "ourworldindata") {
      bySlug.set(chart.slug, chart);
    }
  }

  return Array.from(bySlug.values());
}

// OWID dashboards always render their full dataset into a #data-table
// (every country/year, not just whichever tab is active), even when that
// tab is hidden — so we can read the real numbers straight out of the DOM
// instead of needing a separate fetch of the chart's CSV.
function extractDataTableText(container: HTMLElement, maxRows = 300): string | null {
  const table = container.querySelector("#data-table");
  if (!table) return null;

  const rowToLine = (row: Element) =>
    Array.from(row.querySelectorAll("th, td"))
      .map((cell) => cell.textContent?.trim() || "")
      .join("\t");

  const headerRows = Array.from(table.querySelectorAll("thead tr")).map(rowToLine);
  const bodyRows = Array.from(table.querySelectorAll("tbody tr")).slice(0, maxRows).map(rowToLine);
  const lines = [...headerRows, ...bodyRows].filter((line) => line.replace(/\t/g, "").length > 0);
  return lines.length > 0 ? lines.join("\n") : null;
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

function StepCard({
  step,
  index,
  onAnimate,
  isAnimating,
}: {
  step: StepLog;
  index: number;
  onAnimate: (step: StepLog, index: number) => void;
  isAnimating: boolean;
}) {
  const plan = parsePlan(step.planRaw);
  const beforeImg = step.beforeAction ?? step.before;
  return (
    <article className="stepCard">
      <div className="stepCardHeader">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h3>Step {index + 1}</h3>
          <StopBadge reason={step.stopReason} />
        </div>
        {step.chosenAction && (
          <button
            className="btn secondary"
            disabled={isAnimating}
            title={`Animate: ${step.chosenAction.actionType}`}
            style={{ padding: "2px 10px", fontSize: 12 }}
            onClick={() => onAnimate(step, index)}
          >
            {isAnimating ? "…" : "▶ Animate"}
          </button>
        )}
      </div>

      <div className="captureBox">
        <div>
          <p className="stepLabel">Before</p>
          {beforeImg
            ? <img className="captureImage" src={beforeImg.image} alt="Before" />
            : <div className="captureEmpty">No Capture</div>}
        </div>
        <div>
          <p className="stepLabel">After</p>
          {step.after
            ? <img className="captureImage" src={step.after.image} alt="After" />
            : <div className="captureEmpty">No Capture</div>}
        </div>
      </div>

      {plan.reason && (
        <div>
          <p className="stepLabel" style={{ marginBottom: 4 }}>Reason</p>
          <p style={{ fontSize: 13, margin: 0 }}>{plan.reason}</p>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 12, color: "var(--color-text-muted)" }}>
        {step.model && <span>Model: <strong style={{ color: "var(--color-text)" }}>{step.model}</strong></span>}
        {plan.type && <span>Action: <strong style={{ color: "var(--color-text)" }}>{plan.type}</strong></span>}
        {step.chosenAction?.datumName && (
          <span>Datum: <strong style={{ color: "var(--color-text)" }}>{step.chosenAction.datumName}</strong></span>
        )}
        <span>Answerable: <strong style={{ color: "var(--color-text)" }}>{step.answerable ?? "?"}</strong></span>
      </div>
    </article>
  );
}

function OurWorldDataPage() {
  const { charts: chartCatalog, isLoadingCharts, chartCatalogError } = useChartCatalog();
  const chartViewRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const viewRender = useChartRenderer(chartContainerRef);
  const { isRunning, steps, stopReason, lastError, finalAnswer, run, stop, reset } = useAiRunnerMachine({
    containerRef: chartContainerRef,
    maxStep: MAX_STEP,
  });

  const [question, setQuestion] = useState("");
  const [animatingStep, setAnimatingStep] = useState<number | null>(null);
  const [animationCue, setAnimationCue] = useState<AnimationCue | null>(null);
  const animationTimerRef = useRef<number | null>(null);

  type GradingLogEntry = {
    key: string;
    chartTitle: string;
    question: string;
    modelAnswer: string;
    expectedAnswer: string | null;
    grade: GradeResult;
  };
  const [gradingLog, setGradingLog] = useState<GradingLogEntry[]>([]);
  const lastRunRef = useRef<{
    chartTitle: string;
    question: string;
    chartId: string;
    source: string;
    family: string;
    selectedQuestionIndex: number;
  } | null>(null);
  const loggedAnswerRef = useRef<string | null>(null);

  const currentExpectedAnswer = lastRunRef.current ? findExpectedAnswer(lastRunRef.current.question) : null;
  const currentGrade = finalAnswer ? gradeAnswer(finalAnswer, currentExpectedAnswer) : null;

  useEffect(() => {
    if (stopReason !== "ANSWERED" || !finalAnswer || !lastRunRef.current) return;
    if (loggedAnswerRef.current === finalAnswer) return;
    loggedAnswerRef.current = finalAnswer;

    const lastRun = lastRunRef.current;
    const expected = findExpectedAnswer(lastRun.question);
    const grade = gradeAnswer(finalAnswer, expected);

    setGradingLog((prev) => [
      ...prev,
      {
        key: `${Date.now()}`,
        chartTitle: lastRun.chartTitle,
        question: lastRun.question,
        modelAnswer: finalAnswer,
        expectedAnswer: expected,
        grade,
      },
    ]);

    // persist so the graded run survives a refresh and can be queried later
    // alongside the /ai page's saved runs
    saveAiRun({
      source: lastRun.source,
      family: lastRun.family,
      chartId: lastRun.chartId,
      selectedQuestionIndex: lastRun.selectedQuestionIndex,
      questionText: lastRun.question,
      stopReason,
      expectedAnswer: expected,
      grade,
      steps,
    }).catch((error) => console.error("Failed to save AI run:", error));
  }, [stopReason, finalAnswer, steps]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current != null) window.clearTimeout(animationTimerRef.current);
    };
  }, []);

  // Replays a recorded step's action on the chart that's already mounted in
  // this page (same idea as AnimationPage's replay, but inline — no need to
  // re-render the chart from scratch since it's the same live instance the
  // AI Runner just interacted with).
  async function animateStep(step: StepLog, index: number) {
    const container = chartContainerRef.current;
    const viewEl = chartViewRef.current;
    if (!container || !viewEl || !step.chosenAction) return;

    setAnimatingStep(index);
    try {
      await extractActions(0);
      const registry: IActions[] = [...getActionRegistry()];
      const action = findLiveAction(step.chosenAction, registry, container);
      if (!action) {
        console.warn("Animate: no matching live element for step", index, step.chosenAction);
        return;
      }

      const box = getElementBoxInContainer(action.element, viewEl);
      if (animationTimerRef.current != null) window.clearTimeout(animationTimerRef.current);
      setAnimationCue({ key: Date.now(), stepIndex: index, actionType: action.actionType, label: getCueLabel(action), ...box });
      animationTimerRef.current = window.setTimeout(() => {
        setAnimationCue(null);
        animationTimerRef.current = null;
      }, 1400);

      await new Promise((r) => setTimeout(r, 180));
      await executeAction(action);
    } finally {
      setAnimatingStep(null);
    }
  }

  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  const owidCharts = useMemo(
    () =>
      mergeOwidCharts(chartCatalog)
        .sort((a, b) => a.title.localeCompare(b.title)),
    [chartCatalog],
  );

  const selectedId = viewRender.renderedChartId ?? owidCharts[0]?.id ?? "";
  const sampleQuestions = owidCharts.find((c) => c.id === selectedId)?.questions ?? [];
  const presetQuestion = sampleQuestions[selectedQuestionIndex] ?? "";

  function runAi() {
    const container = chartContainerRef.current;
    const effectiveQuestion = question.trim() || presetQuestion;
    if (!container || !effectiveQuestion.trim()) return;

    const chartMeta = owidCharts.find((c) => c.id === selectedId);
    lastRunRef.current = {
      chartTitle: chartMeta?.title ?? "",
      question: effectiveQuestion,
      chartId: selectedId,
      source: chartMeta?.source ?? "",
      family: chartMeta?.family ?? "",
      selectedQuestionIndex,
    };
    loggedAnswerRef.current = null;

    // fold the chart's full data table into the question text so the
    // existing AI Runner prompt (decideNextAction/generatePrompt) gets the
    // real numbers too, without us touching that prompt's code
    const dataText = extractDataTableText(container);
    const questionText = dataText ? embedOwidData(effectiveQuestion, dataText) : effectiveQuestion;

    run({
      renderedChartId: viewRender.renderedChartId,
      selectedChartId: selectedId,
      selectedQuestionIndex: 0,
      questionText,
      chartType: "",
      renderVersion: viewRender.renderVersion,
    }).catch((e) => alert(String(e)));
  }

  function renderById(id: string) {
    const chartMeta = owidCharts.find((c) => c.id === id);
    if (!chartMeta) return;
    reset();
    setQuestion("");
    setSelectedQuestionIndex(0);
    viewRender.renderChart(chartMeta).catch((e) => alert(String(e)));
  }

  // auto-render the first chart once the catalog has loaded
  useEffect(() => {
    if (!viewRender.renderedChartId && owidCharts.length > 0) {
      renderById(owidCharts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owidCharts]);

  return (
    <div className="owidPage">
      <header className="owidHeader">
        <h1>Our World in Data</h1>

        <select
          className="owidSelect"
          value={selectedId}
          disabled={isLoadingCharts || owidCharts.length === 0}
          onChange={(e) => renderById(e.target.value)}
        >
          {owidCharts.length === 0 ? (
            <option value="">{isLoadingCharts ? "Loading charts…" : "No OurWorldInData charts registered"}</option>
          ) : (
            owidCharts.map((chart) => (
              <option key={chart.id} value={chart.id}>{chart.title}</option>
            ))
          )}
        </select>

        {chartCatalogError && <p className="owidError">Failed to load chart catalog: {chartCatalogError.message}</p>}
      </header>

      <section className="owidAiPanel owidAiPanel--top">
        <h2>AI Runner</h2>

        {sampleQuestions.length > 0 && (
          <select
            className="owidQuestionSelect"
            value={selectedQuestionIndex}
            onChange={(e) => {
              setSelectedQuestionIndex(Number(e.target.value));
              setQuestion("");
            }}
          >
            {sampleQuestions.map((q, i) => (
              <option key={i} value={i}>{q}</option>
            ))}
          </select>
        )}

        <div className="owidQuestionRow">
          <label htmlFor="owid-question">Question:</label>
          <input
            id="owid-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={presetQuestion || "Type a question for the AI to investigate..."}
          />
        </div>

        <div className="controlBox" style={{ display: "flex", gap: 8 }}>
          <button
            className="btn primary"
            disabled={isRunning || !viewRender.renderedChartId || !(question.trim() || presetQuestion)}
            onClick={runAi}
          >
            {isRunning ? "Running..." : "Run AI"}
          </button>
          <button className="btn secondary" disabled={!isRunning} onClick={stop}>Stop</button>
          <button
            className="btn secondary"
            onClick={() => {
              lastRunRef.current = null;
              loggedAnswerRef.current = null;
              reset();
            }}
          >
            Reset
          </button>
        </div>

        {stopReason && <p className="muted">Stop reason: {stopReason}</p>}
        {lastError && <p className="error-text">{lastError}</p>}
      </section>

      <section className="owidAiPanel owidAnswerPanel">
        <h2>Answer</h2>
        {finalAnswer ? (
          <>
            <p className="owidAnswerText">{finalAnswer}</p>
            {currentExpectedAnswer ? (
              <div className="owidGrading">
                <span style={{ color: GRADE_COLOR[currentGrade!] }}>{GRADE_LABEL[currentGrade!]}</span>
                <span className="muted">Expected: {currentExpectedAnswer}</span>
              </div>
            ) : (
              <p className="muted">No reference answer on file for this question — can't auto-grade.</p>
            )}
          </>
        ) : (
          <p className="muted">{isRunning ? "Running…" : "Run a question to see the answer here."}</p>
        )}
      </section>

      <div className="owidBody">
        <div className="owidMain">
          <section className="owidChartView" ref={chartViewRef}>
            {!viewRender.renderedChartId && (
              <div className="owidChartEmpty">
                {isLoadingCharts
                  ? "Loading charts…"
                  : owidCharts.length === 0
                  ? "No OurWorldInData charts registered yet."
                  : "Select a chart above to get started."}
              </div>
            )}
            <ChartPanel
              containerRef={chartContainerRef}
              hasChart={Boolean(viewRender.renderedChartId)}
              isRendering={viewRender.isRendering}
              overlay={null}
            />
            {animationCue && (
              <div
                key={animationCue.key}
                className={`animationCue animationCue--${animationCue.actionType}`}
                style={{ left: animationCue.left, top: animationCue.top, width: animationCue.width, height: animationCue.height }}
                aria-hidden="true"
              >
                <span className="animationCueLabel">
                  Step {animationCue.stepIndex + 1} · {animationCue.label}
                </span>
              </div>
            )}
          </section>
        </div>

        <aside className="owidStepBox">
          <h3>Steps{steps.length > 0 ? ` (${steps.length})` : ""}</h3>
          <div className="owidStepStack">
            {steps.length === 0 ? (
              <p className="muted">No steps yet.</p>
            ) : (
              steps.map((step, index) => (
                <StepCard
                  key={index}
                  step={step}
                  index={index}
                  onAnimate={animateStep}
                  isAnimating={animatingStep === index}
                />
              ))
            )}
          </div>
        </aside>
      </div>

      <section className="owidAiPanel owidGradingPanel">
        <h2>Grading Log{gradingLog.length > 0 ? ` (${gradingLog.length})` : ""}</h2>
        {gradingLog.length === 0 ? (
          <p className="muted">Run a question with a known reference answer to start logging results.</p>
        ) : (
          <table className="owidGradingTable">
            <thead>
              <tr>
                <th>Chart</th>
                <th>Question</th>
                <th>Model answer</th>
                <th>Expected</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {gradingLog.map((entry) => (
                <tr key={entry.key}>
                  <td>{entry.chartTitle}</td>
                  <td>{entry.question}</td>
                  <td>{entry.modelAnswer}</td>
                  <td>{entry.expectedAnswer ?? "—"}</td>
                  <td style={{ color: GRADE_COLOR[entry.grade] }}>{GRADE_LABEL[entry.grade]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export default OurWorldDataPage;
