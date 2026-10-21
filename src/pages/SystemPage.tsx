import { useRef, useState } from "react";
import { useNavigate } from "react-router";

import { ChartPanel } from "@components/builder/ChartPanel";
import { ChartSelectPanel } from "@components/builder/ChartSelectPanel";

import { useChartRenderer } from "@hooks/useChartRenderer";
import { useChartFilters } from "@/hooks/useChartFilters";
import { useChartCatalog } from "@/hooks/useChartMeta";

import type { SystemToAiState } from "@/types/navigationState";

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

  const goToAiPage = (overrideChartId?: string) => {
    const chartId = overrideChartId ?? filters.selectedChartId;
    if (!filters.source || !filters.family || !chartId) return;

    const state: SystemToAiState = {
      source: filters.source,
      family: filters.family,
      selectedChartId: chartId,
      selectedQuestionIndex: filters.selectedQuestionIndex,
      questionText: effectiveQuestion,
    };

    navigate(`/ai`, { state });
  };

  const handleSelectChart = (id: string | "") => {
    filters.setSelectedChartId(id);
    if (id && filters.source && filters.family) {
      goToAiPage(id);
    }
  };

  return (
    <div className="systemPage">
      <header className="systemHeader">
        <div className="systemTitle">
          <h1>Dynamic Charts</h1>
          {/* <p className="systemSubtitle">Select a chart  ask a question.</p> */}
        </div>

        <button className="btn" onClick={() => navigate("/test")}>
          Step Log 테스트
        </button>

        <ChartSelectPanel
          source={filters.source}
          setSource={filters.setSource}
          family={filters.family}
          setFamily={filters.setFamily}
          selectedChartId={filters.selectedChartId}
          setSelectedChartId={handleSelectChart}
          sources={filters.sources}
          families={filters.families}
          charts={filters.charts}
          isLoadingCharts={isLoadingCharts}
          chartCatalogError={chartCatalogError}
          onRender={() => {
            if (!filters.selectedChartId) return;
            const chartMeta = chartCatalog.find((c) => c.id === filters.selectedChartId);
            if (!chartMeta) return;
            viewRender.renderChart(chartMeta).catch((e) => alert(String(e)));
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

      <section className="panel systemSection">
        <h1>Question</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select
            value={selectedQuestion}
            onChange={(e) => {
              filters.setSelectedQuestionIndex(Number(e.target.value));
              setCustomQuestion("");
            }}
          >
            {filters.questions.length === 0 ? (
              <option value={0}>No example questions</option>
            ) : (
              filters.questions.map((question, index) => (
                <option key={`${question}-${index}`} value={index}>{question}</option>
              ))
            )}
          </select>

          <input
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder={presetQuestion || "Or type a custom question..."}
          />
        </div>
      </section>

      <section className="panel aiControlSection">
        <button
          className="btn primary"
          disabled={!filters.selectedChartId || !effectiveQuestion}
          onClick={() => goToAiPage()}
        >
          Next
        </button>
      </section>
    </div>
  );
}

export default SystemPage;
