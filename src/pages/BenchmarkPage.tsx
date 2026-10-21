import { useEffect, useMemo, useState } from "react";

import { getAiRun, listAiRuns, type AiRunSummary, type SavedAiRun } from "@/api/aiRunApi";
import {
  createBenchmarkEpisode,
  listBenchmarkEpisodes,
  type BenchmarkEpisode,
  type InteractionComplexity,
  type QuestionType,
  type ReasoningComplexity,
  type StructuralComplexity,
} from "@/api/benchmarkApi";

import "@styles/global.css";
import "@styles/AIPage.css";

const MIDTERM_TARGET = 30;
const END_OF_TERM_TARGET = 100;

const selectStyle = {
  width: "100%",
  padding: "9px 14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  fontSize: 14,
};

function parsePlan(planRaw: unknown): { reason?: string; type?: string } {
  try {
    const obj = typeof planRaw === "string" ? JSON.parse(planRaw) : planRaw;
    return obj ?? {};
  } catch {
    return {};
  }
}

export default function BenchmarkPage() {
  const [runs, setRuns] = useState<AiRunSummary[]>([]);
  const [episodes, setEpisodes] = useState<BenchmarkEpisode[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<SavedAiRun | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("exact_value_lookup");
  const [structuralComplexity, setStructuralComplexity] = useState<StructuralComplexity>("flat");
  const [interactionComplexity, setInteractionComplexity] = useState<InteractionComplexity>("low");
  const [reasoningComplexity, setReasoningComplexity] = useState<ReasoningComplexity>("single_step");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void refreshLists();
  }, []);

  async function refreshLists() {
    try {
      const [runList, episodeList] = await Promise.all([listAiRuns(), listBenchmarkEpisodes()]);
      setRuns(runList);
      setEpisodes(episodeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const labeledRunIds = useMemo(() => new Set(episodes.map((episode) => episode.runId)), [episodes]);

  async function selectRun(runId: string) {
    setSelectedRunId(runId);
    setSelectedRun(null);
    setError(null);
    setAnswer("");
    setNotes("");
    setLoadingRun(true);
    try {
      const run = await getAiRun(runId);
      setSelectedRun(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRun(false);
    }
  }

  async function submitEpisode() {
    if (!selectedRunId || !answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createBenchmarkEpisode({
        runId: selectedRunId,
        answer: answer.trim(),
        questionType,
        structuralComplexity,
        interactionComplexity,
        reasoningComplexity,
        notes,
      });
      await refreshLists();
      setSelectedRunId(null);
      setSelectedRun(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="systemPage" style={{ display: "grid", gridTemplateColumns: "260px 1fr 320px", gap: 24, maxWidth: 1800 }}>
      <aside style={{ borderRight: "1px solid var(--color-border)", paddingRight: 16 }}>
        <h1 style={{ fontSize: 18 }}>Benchmark Episodes</h1>
        <p className="muted" style={{ fontSize: 13 }}>
          {episodes.length} labeled &middot; {MIDTERM_TARGET} by midterm &middot; {END_OF_TERM_TARGET} by end of term
        </p>

        <h2 style={{ fontSize: 14, marginTop: 24 }}>Saved runs</h2>
        {runs.length === 0 ? (
          <p className="muted">No saved AI runs yet. Run the agent from /ai first.</p>
        ) : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {runs.map((run) => {
              const labeled = labeledRunIds.has(run.id);
              return (
                <button
                  key={run.id}
                  onClick={() => selectRun(run.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    whiteSpace: "normal",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: selectedRunId === run.id ? "var(--color-brand-ghost)" : "var(--color-surface)",
                    cursor: "pointer",
                    opacity: labeled ? 0.6 : 1,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {run.questionText} {labeled && <span style={{ fontSize: 11 }}>(labeled)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {run.family} &middot; {run.stepCount} steps &middot; {run.stopReason ?? "—"}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <main>
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}

        {!selectedRunId && <p className="muted">Select a saved run on the left to label it.</p>}

        {loadingRun && <p className="muted">Loading run…</p>}

        {selectedRun && (
          <>
            <h2 style={{ fontSize: 16 }}>{selectedRun.questionText}</h2>

            <div className="stepList" style={{ display: "grid", gap: 16, marginBottom: 24 }}>
              {selectedRun.steps.map((step, index) => {
                const plan = parsePlan(step.planRaw);
                const beforeImg = step.beforeAction ?? step.before;
                return (
                  <article key={index} className="stepCard">
                    <div className="stepCardHeader">
                      <h3>Step {index + 1}</h3>
                    </div>
                    <div className="captureBox">
                      <div>
                        <p className="stepLabel">Before</p>
                        {beforeImg ? (
                          <img className="captureImage" src={beforeImg.image} alt="Before" />
                        ) : (
                          <div className="captureEmpty">No Capture</div>
                        )}
                      </div>
                      <div>
                        <p className="stepLabel">After</p>
                        {step.after ? (
                          <img className="captureImage" src={step.after.image} alt="After" />
                        ) : (
                          <div className="captureEmpty">No Capture</div>
                        )}
                      </div>
                    </div>
                    {plan.reason && <p style={{ fontSize: 13 }}>{plan.reason}</p>}
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {plan.type && <span>Action: {plan.type}</span>}
                      {step.chosenAction?.datumName && <span> &middot; Datum: {step.chosenAction.datumName}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>

      <aside style={{ borderLeft: "1px solid var(--color-border)", paddingLeft: 16, position: "sticky", top: 24, alignSelf: "start" }}>
        <h2 style={{ fontSize: 16 }}>Label this episode</h2>
        {!selectedRun ? (
          <p className="muted">Select a run to label it.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Answer
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={2}
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Question type
              <select
                value={questionType}
                onChange={(event) => setQuestionType(event.target.value as QuestionType)}
                style={selectStyle}
              >
                <option value="exact_value_lookup">Exact Value Lookup</option>
                <option value="comparison">Comparison</option>
                <option value="hierarchical_reveal">Hierarchical Reveal</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Structural complexity
              <select
                value={structuralComplexity}
                onChange={(event) => setStructuralComplexity(event.target.value as StructuralComplexity)}
                style={selectStyle}
              >
                <option value="flat">Flat</option>
                <option value="hierarchical">Hierarchical</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Interaction complexity
              <select
                value={interactionComplexity}
                onChange={(event) => setInteractionComplexity(event.target.value as InteractionComplexity)}
                style={selectStyle}
              >
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Reasoning complexity
              <select
                value={reasoningComplexity}
                onChange={(event) => setReasoningComplexity(event.target.value as ReasoningComplexity)}
                style={selectStyle}
              >
                <option value="single_step">Single-step</option>
                <option value="multi_step">Multi-step</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              Notes
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                style={{ width: "100%" }}
              />
            </label>

            <button className="btn" disabled={submitting || !answer.trim()} onClick={submitEpisode}>
              {submitting ? "Saving…" : "Save benchmark episode"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
