import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartFilters } from "@hooks/useChartFilters";
import { useChartCatalog } from "@hooks/useChartMeta";

import { extractActions, getActionRegistry, resetExtractRegistries } from "@core/actionExtractor/extractActions";
import { clearActionIdIndex } from "@core/actionExtractor/actionIdStore";
import { captureState } from "@core/utils/getCapture";
import { getImages } from "@core/utils/getImages";
import { sendToAIPost } from "@core/interpretation/sendToAI";
import { getCleanResponse } from "@core/utils/getCleanResponse";
import { generateDirectAnswerPrompt } from "@core/prompts/directAnswer";
import type { DirectAnswerResponse } from "@core/prompts/directAnswer";

import "@styles/global.css";
import "@styles/AIPage.css";
import "@styles/ChartPanel.css";

type Status = "idle" | "capturing" | "extracting" | "calling" | "done" | "error";

type RunState = {
  forKey: string;
  status: Status;
  result: DirectAnswerResponse | null;
  rawResponse: string | null;
  errorMsg: string | null;
  actionCount: number | null;
};

const CONFIDENCE_COLOR: Record<string, string> = {
  HIGH: "#16a34a",
  MEDIUM: "#d97706",
  LOW: "#dc2626",
};

export default function DirectAnswerPage() {
  const navigate = useNavigate();
  const resultContainerRef = useRef<HTMLDivElement | null>(null);
  const autoRenderedChartRef = useRef<string | null>(null);

  const { charts: chartCatalog } = useChartCatalog();
  const filters = useChartFilters(chartCatalog);
  const mainRender = useChartRenderer(resultContainerRef);

  const [customQuestion, setCustomQuestion] = useState("");
  const [runState, setRunState] = useState<RunState>({
    forKey: "", status: "idle", result: null, rawResponse: null, errorMsg: null, actionCount: null,
  });

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = customQuestion.trim() || presetQuestion;
  const currentKey = `${filters.selectedChartId}__${effectiveQuestion}`;

  // Only show run results if they belong to the current chart+question
  const active = runState.forKey === currentKey ? runState : null;
  const isRunning = active !== null && (
    active.status === "capturing" || active.status === "extracting" || active.status === "calling"
  );

  useEffect(() => {
    if (!filters.selectedChartId) return;
    if (autoRenderedChartRef.current === filters.selectedChartId) return;
    const id = filters.selectedChartId;
    autoRenderedChartRef.current = id;
    const chartMeta = chartCatalog.find((c) => c.id === id);
    if (!chartMeta) return;
    mainRender.renderChart(chartMeta).catch((e) => alert(String(e)));
  }, [filters.selectedChartId, chartCatalog, mainRender]);

  async function runDirectAnswer() {
    if (!filters.selectedChartId || mainRender.renderedChartId !== filters.selectedChartId) {
      setRunState((s) => ({ ...s, forKey: currentKey, errorMsg: "Chart not rendered. Please wait for the chart to load.", status: "error" }));
      return;
    }

    const key = currentKey;
    const update = (patch: Partial<RunState>) =>
      setRunState((s) => ({ ...s, forKey: key, ...patch }));

    try {
      update({ status: "capturing", result: null, rawResponse: null, errorMsg: null, actionCount: null });
      const screenshot = await captureState("before", "direct", resultContainerRef.current);

      update({ status: "extracting" });
      resetExtractRegistries();
      clearActionIdIndex();
      await extractActions(0);
      const actions = getActionRegistry();
      update({ actionCount: actions.length });

      const chartMeta = chartCatalog.find((c) => c.id === filters.selectedChartId);
      const chartType = chartMeta?.family ?? "chart";
      const prompt = generateDirectAnswerPrompt(chartType, effectiveQuestion, actions);
      console.log("[DirectAnswer] prompt:", prompt);

      update({ status: "calling" });
      const response = await sendToAIPost({ path: "/chat", prompt, images: getImages(screenshot, null) });
      const clean = await getCleanResponse(response);
      console.log("[DirectAnswer] raw:", clean);

      const parsed: DirectAnswerResponse = JSON.parse(clean);
      update({ status: "done", result: parsed, rawResponse: clean });
    } catch (e) {
      update({ status: "error", errorMsg: String(e) });
    }
  }

  const statusLabel: Record<Status, string> = {
    idle: "",
    capturing: "Capturing screenshot...",
    extracting: "Extracting actions...",
    calling: "Calling AI...",
    done: "",
    error: "",
  };

  const chartTitle = chartCatalog.find((c) => c.id === filters.selectedChartId)?.title;

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Direct Answer</h1>
          {chartTitle && <p className="systemSubtitle">{chartTitle}</p>}
        </div>
        <button className="btn primary" onClick={() => navigate("/")}>Back</button>
      </header>

      {/* Chart selector */}
      <section className="panel systemSection">
        <h1>Chart</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <select value={filters.source} onChange={(e) => filters.setSource(e.target.value)}>
            <option value="">— source —</option>
            {filters.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.family} onChange={(e) => filters.setFamily(e.target.value)}>
            <option value="">— family —</option>
            {filters.families.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select
            value={filters.selectedChartId}
            onChange={(e) => filters.setSelectedChartId(e.target.value)}
          >
            <option value="">— chart —</option>
            {filters.charts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
      </section>

      {/* Question + run */}
      <section className="panel systemSection">
        <h1>Question</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filters.questions.length > 0 && (
            <select
              value={filters.selectedQuestionIndex}
              onChange={(e) => filters.setSelectedQuestionIndex(Number(e.target.value))}
            >
              {filters.questions.map((q, i) => (
                <option key={i} value={i}>{q}</option>
              ))}
            </select>
          )}
          <input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder={presetQuestion || "Type a question..."}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn primary"
              disabled={isRunning || !filters.selectedChartId}
              onClick={runDirectAnswer}
            >
              {isRunning ? "Running..." : "Get Answer"}
            </button>
            {active && statusLabel[active.status as Status] && (
              <span className="muted" style={{ fontSize: 13 }}>{statusLabel[active.status as Status]}</span>
            )}
          </div>
          {active?.errorMsg && <p className="error-text">{active.errorMsg}</p>}
        </div>
      </section>

      {/* Chart + Answer side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* Chart render */}
        <section className="panel animationSection">
          <h1>Chart Preview</h1>
          <div ref={resultContainerRef} className="chartResult" />
        </section>

        {/* Answer */}
        <section className="panel systemSection" style={{ minHeight: 120 }}>
          <h1>Answer</h1>
          {!active?.result && !isRunning && (
            <p className="muted">Run a question to see the answer here.</p>
          )}
          {isRunning && (
            <p className="muted">{statusLabel[active!.status as Status]}</p>
          )}
          {active?.result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* main answer */}
              <div style={{
                padding: "16px 20px",
                background: "#f8f9fc",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
              }}>
                <p style={{ fontSize: 15, margin: 0, lineHeight: 1.6 }}>{active.result.answer}</p>
              </div>

              {/* confidence + action count */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
                <span>
                  Confidence:{" "}
                  <strong style={{ color: CONFIDENCE_COLOR[active.result.confidence] ?? "#6b7280" }}>
                    {active.result.confidence}
                  </strong>
                </span>
                {active.actionCount !== null && (
                  <span className="muted">Actions extracted: {active.actionCount}</span>
                )}
              </div>

              {/* reasoning */}
              <div>
                <p className="stepLabel" style={{ marginBottom: 6 }}>Reasoning</p>
                <p style={{ fontSize: 13, margin: 0, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                  {active.result.reasoning}
                </p>
              </div>

              {/* relevant actions */}
              {active.result.relevant_actions && active.result.relevant_actions.length > 0 && (
                <div>
                  <p className="stepLabel" style={{ marginBottom: 6 }}>Relevant actions for more info</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {active.result.relevant_actions.map((a, i) => (
                      <div key={i} style={{
                        fontSize: 12,
                        padding: "6px 10px",
                        background: "var(--color-surface)",
                        borderRadius: 6,
                        border: "1px solid var(--color-border)",
                        display: "flex", gap: 10, alignItems: "baseline",
                      }}>
                        <span style={{ fontWeight: 600 }}>#{a.index}</span>
                        <span style={{ color: "var(--color-text-muted)" }}>{a.actionType}</span>
                        {a.datum && <span>{a.datum}</span>}
                        <span style={{ color: "var(--color-text-muted)", flex: 1 }}>{a.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* raw */}
              <details>
                <summary style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>
                  Raw response
                </summary>
                <pre className="rawResponse" style={{ marginTop: 6 }}>{active.rawResponse}</pre>
              </details>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
