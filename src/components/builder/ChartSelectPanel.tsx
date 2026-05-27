import type { Family, Source } from "@/hooks/useChartMeta";
import { getTitle } from "@/hooks/useChartMeta";
import type { ChartMetadata } from "@core/models/types/ChartMetadata";
import "@styles/ChartSelectPanel.css";

type Props = {
  source: Source | "";
  setSource: (v: Source) => void;
  family: Family | "";
  setFamily: (v: Family) => void;
  selectedChartId: string | "";
  setSelectedChartId: (v: string | "") => void;

  sources: Source[];
  families: Family[];
  charts: ChartMetadata[];
  isLoadingCharts?: boolean;
  chartCatalogError?: Error | null;

  onRender: () => void;
  renderedChartId: string | null;

  isRunning: boolean;
  isRendering: boolean;

  onSourceChanged?: () => void; // 선택 바뀔 때 렌더된 상태 reset 같은 것
};

export function ChartSelectPanel(props: Props) {
  const {
    source, setSource, family, setFamily,
    selectedChartId, setSelectedChartId,
    sources, families, charts,
    onRender, renderedChartId,
    isRunning, isRendering,
    isLoadingCharts, chartCatalogError,
    onSourceChanged,
  } = props;

  const renderedChart = charts.find((chart) => chart.id === renderedChartId);

  return (
    <section className="selectPanel">
      <h1 className="title">Chart Select</h1>
      <div className="filters">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value as Source);
            onSourceChanged?.();
          }}
          disabled={isRunning || isLoadingCharts}
        >
          <option value="" disabled>Select source</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={family}
          onChange={(e) => setFamily(e.target.value as Family)}
          disabled={isRunning || isLoadingCharts}
        >
          <option value="" disabled>Select family</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          value={selectedChartId}
          onChange={(e) => setSelectedChartId(e.target.value)}
          disabled={isRunning || isLoadingCharts}
        >
          <option value="" disabled>{isLoadingCharts ? "Loading charts" : "Select id"}</option>
          {charts.map((chart) => (
            <option key={chart.id} value={chart.id}>{getTitle(chart)}</option>
          ))}
        </select>

        <button
          className="btn primary"
          onClick={onRender}
          disabled={!selectedChartId || isRendering || isRunning || isLoadingCharts}
        >
          {isRendering ? "Rendering…" : "Render"}
        </button>

        <div className="badge">
          Rendered: <b>{renderedChartId ? (renderedChart?.title ?? renderedChartId) : "none"}</b>
        </div>
        {chartCatalogError ? <div className="badge">Using local chart catalog</div> : null}
      </div>
    </section>
  );
}
