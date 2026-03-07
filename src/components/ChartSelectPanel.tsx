import type { ChartId } from "@core/charts/chartRegistry";
import type { Family, Source } from "@hooks/useChartMeta";
import { getTitle } from "@hooks/useChartMeta";
import "@styles/ChartSelectPanel.css";

type Props = {
  source: Source | "";
  setSource: (v: Source) => void;
  family: Family | "";
  setFamily: (v: Family) => void;
  selectedChartId: ChartId | "";
  setSelectedChartId: (v: ChartId) => void;

  sources: Source[];
  families: Family[];
  charts: ChartId[];

  onRender: () => void;
  renderedChartId: ChartId | null;

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
    onSourceChanged,
  } = props;

  return (
    <section className="selectPanel">
      <h1>Chart Select</h1>
      <div className="filters">
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value as Source);
            onSourceChanged?.();
          }}
          disabled={isRunning}
        >
          <option value="" disabled>Select source</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={family}
          onChange={(e) => setFamily(e.target.value as Family)}
          disabled={isRunning}
        >
          <option value="" disabled>Select family</option>
          {families.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          value={selectedChartId}
          onChange={(e) => setSelectedChartId(e.target.value as ChartId)}
          disabled={isRunning}
        >
          <option value="" disabled>Select id</option>
          {charts.map((id) => <option key={id} value={id}>{getTitle(id)}</option>)}
        </select>

        <button
          className="btn secondary"
          onClick={onRender}
          disabled={!selectedChartId || isRendering || isRunning}
        >
          {isRendering ? "Rendering…" : "Render Chart"}
        </button>

        <div className="badge">
          Rendered: <b>{renderedChartId ? getTitle(renderedChartId) : "none"}</b>
        </div>
      </div>
    </section>
  );
}