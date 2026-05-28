import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { v4 as uuidv4 } from "uuid";

import { ResultPanel } from "@components/builder/ResultPanel";
import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartFilters } from "@hooks/useChartFilters";
import { useChartCatalog } from "@hooks/useChartMeta";
import { ChartSelectPanel } from "@components/builder/ChartSelectPanel";

import { captureState } from "@core/utils/getCapture";
import { extractActions, getActionRegistry } from "@core/actionExtractor/extractActions";
// import { fetchKeywords } from "@/api/keywordsApi";
// import { scoreActions } from "@core/actionExtractor/rankActions";
// import { setActionRegistry } from "@core/actionExtractor/extractActions";
// import type { ScoredAction } from "@core/actionExtractor/rankActions";
// import type { KeywordResult } from "@/api/keywordsApi";
import { generatePrompt } from "@core/prompts/answer";
import { getCleanResponse } from "@core/utils/getCleanResponse";
import { getAnswer } from "@core/interpretation/decideNextAction";
import { executeAction } from "@core/autoAction/executeAction";
import { sendToAIPost } from "@core/ai/sendToAI";
import { getImages } from "@core/utils/getImages";
import { addSemanticEntry, getSemanticRegistry } from "@core/actionExtractor/semanticRegistry";
import { getEffectPrompt } from "@core/interpretation/getEffectPrompt";
import type { SemanticEntry } from "@core/actionExtractor/semanticRegistry";
import type { IActions } from "@core/models/interface/IActions";
import type { imageState } from "@core/models/interface/IimageState";

import "@styles/global.css";

type CapturedStep = {
  prompt: string;
  screenshot: string;
};

type ParsedResult = {
  answerable: string;
  type: string;
  targetIndex: number | null;
  reason: string;
  raw: string;
};

type StepRecord = {
  stepNumber: number;
  prompt: string;
  screenshot: string;          // before
  gptResponse: string;
  parsed: ParsedResult;
  afterScreenshot: string | null;
  effectResponse: string | null;
};

export default function ManualAiPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { charts: chartCatalog } = useChartCatalog();
  const filters = useChartFilters(chartCatalog);
  const renderer = useChartRenderer(containerRef);

  const [question, setQuestion] = useState("");
  const [captured, setCaptured] = useState<CapturedStep | null>(null);
  const [gptResponse, setGptResponse] = useState("");
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isAskingEffect, setIsAskingEffect] = useState(false);
  const [afterScreenshot, setAfterScreenshot] = useState<string | null>(null);
  const [effectResponse, setEffectResponse] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  // const [scoredActions, setScoredActions] = useState<ScoredAction[] | null>(null);
  // const [kwResult, setKwResult] = useState<KeywordResult | null>(null);
  const [semanticEntries, setSemanticEntries] = useState<SemanticEntry[]>([]);

  // multi-step state
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const stopRequestedRef = useRef(false);

  const actionRegistryRef = useRef<IActions[]>([]);
  const beforeStateRef = useRef<imageState | null>(null);
  // snapshot of effective question at capture time (stays consistent across steps)
  const effectiveQuestionRef = useRef("");
  // manually tracked history of executed actions (installActionLogger is never called)
  const executedActionsRef = useRef<Partial<IActions>[]>([]);

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = question.trim() || presetQuestion;

  // ── core capture (shared between manual trigger & auto-continue) ──────────
  async function captureCore(currentStepIndex: number) {
    if (!filters.selectedChartId) return;
    setIsCapturing(true);
    setCaptured(null);
    setParsed(null);
    setParseError(null);
    setGptResponse("");
    setAfterScreenshot(null);
    setEffectResponse(null);

    try {
      const id = uuidv4().split("-")[0];
      const state = await captureState("before", id, containerRef.current);
      if (!state) throw new Error("스크린샷 캡처 실패");

      await extractActions(0);
      const q = effectiveQuestionRef.current;
      // const kw = await fetchKeywords(q).catch(() => null);
      // setKwResult(kw);
      // if (kw) {
      //   const scored = scoreActions(getActionRegistry(), kw).sort((a, b) => b.score - a.score);
      //   setScoredActions(scored);
      //   setActionRegistry(scored.map(s => s.action));
      // } else {
      //   setScoredActions(null);
      // }
      const actionRegistry = getActionRegistry();
      actionRegistryRef.current = actionRegistry;

      const chartMeta = chartCatalog.find((c) => c.id === filters.selectedChartId);
      const chartType = chartMeta?.family ?? "";

      // use manually tracked history (installActionLogger is never called globally)
      const prompt = generatePrompt(chartType, q, executedActionsRef.current, actionRegistry);
      beforeStateRef.current = state;
      setCaptured({ prompt, screenshot: state.image });
      void currentStepIndex; // used only for clarity
    } catch (e) {
      alert(String(e));
    } finally {
      setIsCapturing(false);
    }
  }

  // ── "시작" button — resets everything and starts step 0 ─────────────────
  async function handleStart() {
    if (!filters.selectedChartId) return;
    stopRequestedRef.current = false;
    executedActionsRef.current = [];
    setIsDone(false);
    setSteps([]);
    setStepIndex(0);
    effectiveQuestionRef.current = effectiveQuestion;
    await captureCore(0);
  }

  // ── "새로 시작" — full reset ─────────────────────────────────────────────
  function handleReset() {
    stopRequestedRef.current = false;
    executedActionsRef.current = [];
    setIsDone(false);
    setSteps([]);
    setStepIndex(0);
    setCaptured(null);
    setGptResponse("");
    setParsed(null);
    setParseError(null);
    setAfterScreenshot(null);
    setEffectResponse(null);
  }

  // ── copy helpers ─────────────────────────────────────────────────────────
  async function handleCopyImage() {
    if (!captured) return;
    // captured.screenshot is a JPEG data URL; clipboard API requires PNG → convert via canvas
    const img = new Image();
    img.src = captured.screenshot;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    setCopiedImage(true);
    setTimeout(() => setCopiedImage(false), 2000);
  }

  async function handleCopy() {
    if (!captured) return;
    await navigator.clipboard.writeText(captured.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── execute ──────────────────────────────────────────────────────────────
  async function handleExecute() {
    if (!parsed || parsed.targetIndex == null) return;
    const chosen = actionRegistryRef.current[parsed.targetIndex];
    if (!chosen) {
      alert(`targetIndex ${parsed.targetIndex}에 해당하는 액션이 없습니다.`);
      return;
    }
    setIsExecuting(true);
    setAfterScreenshot(null);
    setEffectResponse(null);

    let afterImg: string | null = null;
    let effectRaw: string | null = null;

    try {
      await executeAction(chosen);
      // record executed action so next step's prompt sees the history
      executedActionsRef.current = [...executedActionsRef.current, chosen];
      const id = uuidv4().split("-")[0];
      const after = await captureState("after", id, containerRef.current);
      if (after) {
        afterImg = after.image;
        setAfterScreenshot(after.image);
        setIsExecuting(false);
        setIsAskingEffect(true);

        const imgs = getImages(beforeStateRef.current, after);
        const res = await sendToAIPost({ path: "/chat", prompt: getEffectPrompt(parsed.type, parsed.targetIndex), images: imgs });
        effectRaw = typeof res === "string" ? res : (res?.text ?? res?.response ?? JSON.stringify(res));
        setEffectResponse(effectRaw);

        try {
          const parsed2 = JSON.parse(effectRaw!);
          if (parsed2?.effect) {
            addSemanticEntry(chosen, parsed2.effect);
            setSemanticEntries(getSemanticRegistry().slice());
          }
        } catch { /* ignore */ }
      }
    } catch (e) {
      alert(String(e));
      setIsExecuting(false);
      setIsAskingEffect(false);
      return;
    }

    // ── save completed step ──────────────────────────────────────────────
    const completedStep: StepRecord = {
      stepNumber: stepIndex,
      prompt: captured!.prompt,
      screenshot: captured!.screenshot,
      gptResponse,
      parsed,
      afterScreenshot: afterImg,
      effectResponse: effectRaw,
    };
    setSteps(prev => [...prev, completedStep]);
    const nextStep = stepIndex + 1;
    setStepIndex(nextStep);

    // ── decide whether to continue ───────────────────────────────────────
    const shouldStop = stopRequestedRef.current || parsed.answerable === "YES";
    setIsExecuting(false);
    setIsAskingEffect(false);

    if (shouldStop) {
      setIsDone(true);
      setCaptured(null);
    } else {
      // auto-capture next state
      await captureCore(nextStep);
    }
  }

  // ── parse GPT response ────────────────────────────────────────────────────
  async function handleParse() {
    setParseError(null);
    setParsed(null);
    try {
      const cleaned = await getCleanResponse(gptResponse);
      const answer = getAnswer(cleaned);
      if (!answer) throw new Error("JSON 파싱 실패 — 형식을 확인하세요.");
      setParsed({
        answerable: answer.answerable ?? "?",
        type: (answer as any).type ?? "?",
        targetIndex: answer.targetIndex ?? null,
        reason: (answer as any).reason ?? "",
        raw: cleaned,
      });
    } catch (e) {
      setParseError(String(e));
    }
  }

  const isRunning = isCapturing || isExecuting || isAskingEffect;

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Manual AI</h1>
          <p className="systemSubtitle">프롬프트를 복사해 ChatGPT에 직접 물어보세요.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {steps.length > 0 && (
            <button className="btn secondary" onClick={handleReset} disabled={isRunning}>
              새로 시작
            </button>
          )}
          {!isDone && (captured || isCapturing) && (
            <button
              className="btn"
              style={{ background: "var(--color-error, #e53e3e)", color: "#fff", border: "none" }}
              disabled={stopRequestedRef.current}
              onClick={() => { stopRequestedRef.current = true; }}
            >
              멈추기
            </button>
          )}
          <button className="btn secondary" onClick={() => navigate("/")}>Back</button>
        </div>
      </header>

      {/* ── 차트 선택 ──────────────────────────────────────────────────────── */}
      <section className="panel systemSection">
        <h1>Chart</h1>
        <ChartSelectPanel
          source={filters.source}
          setSource={filters.setSource}
          family={filters.family}
          setFamily={filters.setFamily}
          selectedChartId={filters.selectedChartId}
          setSelectedChartId={(id: string) => {
            filters.setSelectedChartId(id);
            const meta = chartCatalog.find((c) => c.id === id);
            if (meta) renderer.renderChart(meta).catch((e) => alert(String(e)));
          }}
          sources={filters.sources}
          families={filters.families}
          charts={filters.charts}
          renderedChartId={renderer.renderedChartId}
          isRunning={false}
          isRendering={renderer.isRendering}
          onRender={() => {
            const meta = chartCatalog.find((c) => c.id === filters.selectedChartId);
            if (meta) renderer.renderChart(meta).catch((e) => alert(String(e)));
          }}
        />

        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-muted)" }}>
            Question
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={filters.selectedQuestionIndex}
              onChange={(e) => filters.setSelectedQuestionIndex(Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {filters.questions.length === 0
                ? <option value={0}>No example questions</option>
                : filters.questions.map((q, i) => <option key={i} value={i}>{q}</option>)
              }
            </select>
          </div>
          <input
            style={{ marginTop: 8, width: "100%", boxSizing: "border-box" }}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={presetQuestion || "직접 질문을 입력하세요..."}
          />
        </div>

        <ResultPanel containerRef={containerRef} />

        <button
          className="btn primary"
          style={{ marginTop: 16 }}
          disabled={isRunning || !filters.selectedChartId}
          onClick={handleStart}
        >
          {isCapturing ? "캡처 중..." : steps.length === 0 ? "시작" : "재시작"}
        </button>
      </section>

      {/* ── 완료 메시지 ────────────────────────────────────────────────────── */}
      {isDone && (
        <section className="panel systemSection" style={{ borderLeft: "4px solid var(--color-primary)" }}>
          <h1>완료</h1>
          <p style={{ fontSize: 14 }}>
            {steps.length}개 스텝 수행 완료.{" "}
            {steps[steps.length - 1]?.parsed.answerable === "YES"
              ? "AI가 질문에 답할 수 있다고 판단했습니다."
              : "수동으로 멈췄습니다."}
          </p>
        </section>
      )}

      {/* ── 키워드 + 랭킹 (비활성화) ─────────────────────────────────────────
      {captured && (
        <section className="panel systemSection">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1>Action Ranking</h1>
            <span style={{
              fontSize: 12, padding: "3px 10px", borderRadius: 12,
              background: "var(--color-primary)", color: "#fff", fontWeight: 600,
            }}>
              Step {stepIndex + 1}
            </span>
          </div>

          {kwResult && (
            <div style={{ marginBottom: 12 }}>
              <p className="stepLabel" style={{ marginBottom: 6 }}>추출된 키워드</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {kwResult.keywords.map((k, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: "3px 8px", borderRadius: 12,
                    background: "var(--color-surface)", border: "1px solid var(--color-border)",
                    color: "var(--color-text-muted)",
                  }}>
                    <strong style={{ color: "var(--color-text)" }}>{k.text}</strong>
                    {" "}{k.type} · {k.score.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {scoredActions && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)", textAlign: "left", color: "var(--color-text-muted)" }}>
                    <th style={{ padding: "6px 8px" }}>#</th>
                    <th style={{ padding: "6px 8px" }}>Score</th>
                    <th style={{ padding: "6px 8px" }}>Type</th>
                    <th style={{ padding: "6px 8px" }}>Datum</th>
                    <th style={{ padding: "6px 8px" }}>Text</th>
                    <th style={{ padding: "6px 8px" }}>Selector</th>
                    <th style={{ padding: "6px 8px" }}>Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredActions.slice(0, 15).map(({ action, score, matchedKeywords }, i) => (
                    <tr key={action.actionId} style={{
                      borderBottom: "1px solid var(--color-border)",
                      background: i === 0 ? "color-mix(in srgb, var(--color-primary) 8%, transparent)" : undefined,
                    }}>
                      <td style={{ padding: "5px 8px", fontWeight: i === 0 ? 700 : undefined }}>{i}</td>
                      <td style={{ padding: "5px 8px", fontVariantNumeric: "tabular-nums" }}>{score.toFixed(2)}</td>
                      <td style={{ padding: "5px 8px" }}>{action.actionType}</td>
                      <td style={{ padding: "5px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.datum?.name ?? "—"}</td>
                      <td style={{ padding: "5px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{action.text || "—"}</td>
                      <td style={{ padding: "5px 8px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{action.selector ?? "—"}</td>
                      <td style={{ padding: "5px 8px" }}>
                        {matchedKeywords.length > 0
                          ? matchedKeywords.map((m, j) => <span key={j} style={{ marginRight: 4, color: "var(--color-primary)", fontWeight: 600 }}>{m}</span>)
                          : <span style={{ color: "var(--color-text-muted)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scoredActions.length > 15 && (
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
                  +{scoredActions.length - 15}개 더 있음
                </p>
              )}
            </div>
          )}

          {!kwResult && <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>키워드 서버 응답 없음 — 랭킹 미적용</p>}
        </section>
      )}
      ── */}

      {/* ── 프롬프트 + 스크린샷 ────────────────────────────────────────────── */}
      {captured && (
        <section className="panel systemSection">
          <h1>ChatGPT에 붙여넣을 내용</h1>

          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            {/* 스크린샷 */}
            <div style={{ flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p className="stepLabel">스크린샷</p>
                <button className="btn secondary" onClick={handleCopyImage} style={{ fontSize: 12 }}>
                  {copiedImage ? "복사됨 ✓" : "이미지 복사"}
                </button>
              </div>
              <img
                src={captured.screenshot}
                alt="chart screenshot"
                style={{ width: 320, borderRadius: 8, border: "1px solid var(--color-border)" }}
              />
            </div>

            {/* 프롬프트 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p className="stepLabel">프롬프트</p>
                <button className="btn secondary" onClick={handleCopy} style={{ fontSize: 12 }}>
                  {copied ? "복사됨 ✓" : "복사"}
                </button>
              </div>
              <pre className="rawResponse" style={{ maxHeight: 360, overflow: "auto" }}>
                {captured.prompt}
              </pre>
            </div>
          </div>
        </section>
      )}

      {/* ── ChatGPT 응답 입력 ─────────────────────────────────────────────── */}
      {captured && (
        <section className="panel systemSection">
          <h1>ChatGPT 응답 붙여넣기</h1>
          <textarea
            value={gptResponse}
            onChange={(e) => setGptResponse(e.target.value)}
            placeholder={`ChatGPT 응답을 여기에 붙여넣으세요.\n예시:\n{\n  "answerable": "NO",\n  "type": "CLICK",\n  "targetIndex": 2,\n  "reason": "..."\n}`}
            rows={10}
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "monospace",
              fontSize: 13,
              padding: 12,
              borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              resize: "vertical",
            }}
          />
          <button
            className="btn primary"
            style={{ marginTop: 10 }}
            disabled={!gptResponse.trim()}
            onClick={handleParse}
          >
            파싱
          </button>

          {parseError && <p className="error-text" style={{ marginTop: 8 }}>{parseError}</p>}

          {parsed && (
            <div style={{ marginTop: 16 }}>
              <p className="stepLabel" style={{ marginBottom: 8 }}>파싱 결과</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
                {[
                  { label: "Answerable", value: parsed.answerable },
                  { label: "Action Type", value: parsed.type },
                  { label: "Target Index", value: parsed.targetIndex ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--color-bg)", borderRadius: 6, padding: "10px 14px", border: "1px solid var(--color-border)" }}>
                    <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "0 0 4px" }}>{label}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{String(value)}</p>
                  </div>
                ))}
              </div>
              {parsed.reason && (
                <div>
                  <p className="stepLabel" style={{ marginBottom: 4 }}>Reason</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{parsed.reason}</p>
                </div>
              )}
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>Raw JSON</summary>
                <pre className="rawResponse" style={{ marginTop: 6 }}>{parsed.raw}</pre>
              </details>

              {parsed.answerable === "NO" && parsed.targetIndex != null && (
                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <button
                    className="btn primary"
                    disabled={isExecuting || isAskingEffect}
                    onClick={handleExecute}
                  >
                    {isExecuting ? "실행 중..." : isAskingEffect ? "효과 분석 중..." : `Execute → Step ${stepIndex + 1} (index ${parsed.targetIndex})`}
                  </button>

                  {afterScreenshot && (
                    <div>
                      <p className="stepLabel" style={{ marginBottom: 6 }}>실행 후 스크린샷</p>
                      <img
                        src={afterScreenshot}
                        alt="after screenshot"
                        style={{ width: "100%", maxWidth: 480, borderRadius: 8, border: "1px solid var(--color-border)" }}
                      />
                    </div>
                  )}

                  {effectResponse && (
                    <div style={{ background: "var(--color-bg)", borderRadius: 6, padding: "12px 16px", border: "1px solid var(--color-border)" }}>
                      <p className="stepLabel" style={{ marginBottom: 6 }}>AI 효과 분석</p>
                      <pre className="rawResponse">{effectResponse}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Step History ──────────────────────────────────────────────────── */}
      {steps.length > 0 && (
        <section className="panel systemSection">
          <h1>Step History ({steps.length})</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((step) => (
              <details
                key={step.stepNumber}
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <summary style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--color-surface)",
                  fontSize: 13,
                  userSelect: "none",
                  listStyle: "none",
                }}>
                  <span style={{
                    fontWeight: 700, fontSize: 12, padding: "2px 8px", borderRadius: 10,
                    background: "var(--color-primary)", color: "#fff", flexShrink: 0,
                  }}>
                    Step {step.stepNumber + 1}
                  </span>
                  <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                    {step.parsed.type} · index {step.parsed.targetIndex ?? "—"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>
                    {step.parsed.answerable === "YES" ? "✅ Answerable" : ""}
                  </span>
                  {step.effectResponse && (() => {
                    try { return JSON.parse(step.effectResponse)?.effect ?? ""; }
                    catch { return ""; }
                  })() && (
                    <span style={{
                      fontSize: 12, color: "var(--color-text)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300,
                    }}>
                      — {(() => { try { return JSON.parse(step.effectResponse!)?.effect; } catch { return ""; } })()}
                    </span>
                  )}
                </summary>

                <div style={{ padding: "12px 14px", display: "flex", gap: 16, flexWrap: "wrap", background: "var(--color-bg)" }}>
                  {/* before / after screenshots */}
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div>
                      <p className="stepLabel" style={{ marginBottom: 4 }}>Before</p>
                      <img src={step.screenshot} alt="before" style={{ width: 200, borderRadius: 6, border: "1px solid var(--color-border)" }} />
                    </div>
                    {step.afterScreenshot && (
                      <div>
                        <p className="stepLabel" style={{ marginBottom: 4 }}>After</p>
                        <img src={step.afterScreenshot} alt="after" style={{ width: 200, borderRadius: 6, border: "1px solid var(--color-border)" }} />
                      </div>
                    )}
                  </div>

                  {/* details */}
                  <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {[
                        { label: "Answerable", value: step.parsed.answerable },
                        { label: "Action Type", value: step.parsed.type },
                        { label: "Target Index", value: step.parsed.targetIndex ?? "—" },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: "var(--color-surface)", borderRadius: 6, padding: "8px 10px", border: "1px solid var(--color-border)" }}>
                          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "0 0 3px" }}>{label}</p>
                          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{String(value)}</p>
                        </div>
                      ))}
                    </div>

                    {step.parsed.reason && (
                      <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                        <strong>Reason:</strong> {step.parsed.reason}
                      </p>
                    )}

                    {step.effectResponse && (
                      <div style={{ background: "var(--color-surface)", borderRadius: 6, padding: "8px 10px", border: "1px solid var(--color-border)" }}>
                        <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "0 0 4px" }}>Effect</p>
                        <pre className="rawResponse" style={{ fontSize: 11, margin: 0 }}>{step.effectResponse}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ── Semantic Registry ─────────────────────────────────────────────── */}
      {semanticEntries.length > 0 && (
        <section className="panel systemSection">
          <h1>Semantic Registry</h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {semanticEntries.map((entry, i) => (
              <div key={i} style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                padding: "10px 14px",
                display: "grid",
                gridTemplateColumns: "auto auto 1fr",
                gap: "6px 16px",
                alignItems: "start",
                fontSize: 13,
              }}>
                <span style={{ fontFamily: "monospace", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{entry.signature}</span>
                <span style={{ padding: "1px 8px", borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 11, whiteSpace: "nowrap" }}>{entry.actionType}</span>
                <span style={{ color: "var(--color-text)" }}>{entry.effect}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
