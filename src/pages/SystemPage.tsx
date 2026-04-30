import { useRef, useState } from "react";
import { useNavigate } from "react-router";

import { ChartPanel } from "@components/builder/ChartPanel";
import { ChartSelectPanel } from "@components/builder/ChartSelectPanel";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";

import type { ChartId } from "@core/charts/chartRegistry";
import type { SystemToAiState } from "./navigationState";

import "@styles/global.css";

function SystemPage() {
  const navigate = useNavigate();
  const { charts: chartCatalog, isLoadingCharts, chartCatalogError } = useChartCatalog();
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const filters = useChartFilters(chartCatalog);

  const viewRender = useChartRenderer(chartContainerRef);

  const [customQuestion, setCustomQuestion] = useState("");

  const presetQuestion = filters.questions[filters.selectedQuestionIndex] ?? "";
  const effectiveQuestion = customQuestion.trim() || presetQuestion;
  const selectedQuestion = filters.selectedQuestionIndex;

  const goToAiPage = () => {
    if (!filters.source || !filters.family || !filters.selectedChartId) return;

    const state: SystemToAiState = {
      source: filters.source,
      family: filters.family,
      selectedChartId: filters.selectedChartId as ChartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
    };

    navigate("/ai", { state });
  };

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Dynamic charts</h1>
          <p className="systemSubtitle">
            Render → Run → Inspect system logs (no extra UI)
          </p>
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
            const id = filters.selectedChartId as ChartId;
            viewRender.renderChart(id).catch((e) => alert(String(e)));
          }}
          renderedChartId={viewRender.renderedChartId}
          isRunning={false}
          isRendering={viewRender.isRendering}
          onSourceChanged={() => {
            viewRender.resetRendered();
            filters.setSelectedChartId("");
            filters.setSelectedQuestionIndex(0);
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
      

      {/* =============== Question & AI run =================== */}
      <section className="panel systemSection">
        <div className="panel questionSection" style={{ display: "grid", gap: 8 }}>
          <label style={{ fontWeight: 700 }}>Question </label>

          <select
            value={selectedQuestion}
            onChange={(e) => {
              filters.setSelectedQuestionIndex(Number(e.target.value));
              setCustomQuestion("");
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e5e5",
            }}
          >
            {filters.questions.length === 0? (
              <option value={0}>No example questions</option>
            ): (
              filters.questions.map((question, index) => (
                <option key={`${question}-${index}`} value={index}>{question}</option>
              ))
            )}
          </select> 
          
          <input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder={presetQuestion || "Type a question..."}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #e5e5e5" }}
          />
        </div>
      </section>
      
      <section className="panel aiControlSection">
        <button
          className="btn primary"
          disabled={!filters.selectedChartId || !effectiveQuestion}
          onClick={goToAiPage}
        >
          Next: Run AI
        </button>
      </section>

    </div>
  );
}

export default SystemPage;
