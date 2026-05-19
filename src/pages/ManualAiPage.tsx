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
import { getActionHistory } from "@core/actionExtractor/actionLogger";
import { generatePrompt } from "@core/prompts/answer";
import { getCleanResponse } from "@core/utils/getCleanResponse";
import { getAnswer } from "@core/interpretation/decideNextAction";
import { executeAction } from "@core/autoAction/executeAction";
import { sendToAIPost } from "@core/ai/sendToAI";
import { getImages } from "@core/utils/getImages";
import type { IActions } from "@core/models/interface/IActions";
import type { imageState } from "@core/utils/getCapture";

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
  const actionRegistryRef = useRef<IActions[]>([]);
  const beforeStateRef = useRef<imageState | null>(null);

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = question.trim() || presetQuestion;

  async function handleCapture() {
    if (!filters.selectedChartId) return;
    setIsCapturing(true);
    setCaptured(null);
    setParsed(null);
    setParseError(null);
    setGptResponse("");

    try {
      const id = uuidv4().split("-")[0];
      const state = await captureState("before", id);
      if (!state) throw new Error("스크린샷 캡처 실패");

      await extractActions(0);
      const actionRegistry = getActionRegistry();
      const actionHistory = getActionHistory();
      actionRegistryRef.current = actionRegistry;

      const chartMeta = chartCatalog.find((c) => c.id === filters.selectedChartId);
      const chartType = chartMeta?.family ?? "";

      const prompt = generatePrompt(chartType, effectiveQuestion, actionHistory, actionRegistry);

      setAfterScreenshot(null);
      setEffectResponse(null);
      beforeStateRef.current = state;
      setCaptured({ prompt, screenshot: state.image });
    } catch (e) {
      alert(String(e));
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleCopyImage() {
    if (!captured) return;
    const res = await fetch(captured.screenshot);
    const blob = await res.blob();
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
    try {
      await executeAction(chosen);
      const id = uuidv4().split("-")[0];
      const after = await captureState("after", id);
      if (after) {
        setAfterScreenshot(after.image);
        setIsExecuting(false);
        setIsAskingEffect(true);
        const imgs = getImages(beforeStateRef.current, after);
        const effectPrompt = `You are analyzing the visual effect of a user interaction on an interactive chart.
The first image shows the chart BEFORE the action, and the second image shows the chart AFTER the action.
Action performed: ${parsed.type} on element index ${parsed.targetIndex}.

Describe in one or two sentences what visual change occurred as a result of this action.
Be specific about what changed (e.g. tooltip appeared, element highlighted, chart zoomed, data filtered, etc.).
Output JSON only: { "effect": "..." }`;
        const res = await sendToAIPost({ path: "/chat", prompt: effectPrompt, images: imgs });
        const raw = typeof res === "string" ? res : (res?.text ?? res?.response ?? JSON.stringify(res));
        setEffectResponse(raw);
      }
    } catch (e) {
      alert(String(e));
    } finally {
      setIsExecuting(false);
      setIsAskingEffect(false);
    }
  }

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

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Manual AI</h1>
          <p className="systemSubtitle">프롬프트를 복사해 ChatGPT에 직접 물어보세요.</p>
        </div>
        <button className="btn secondary" onClick={() => navigate("/")}>Back</button>
      </header>

      {/* 차트 선택 */}
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
          disabled={isCapturing || !filters.selectedChartId}
          onClick={handleCapture}
        >
          {isCapturing ? "캡처 중..." : "현재 상태 캡처"}
        </button>
      </section>

      {/* 프롬프트 + 스크린샷 */}
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

      {/* ChatGPT 응답 입력 */}
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
                    {isExecuting ? "실행 중..." : isAskingEffect ? "효과 분석 중..." : `Execute (index ${parsed.targetIndex})`}
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
    </div>
  );
}
