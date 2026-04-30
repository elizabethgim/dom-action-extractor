import "@styles/ChartPanel.css";

export function  ChartPanel({ containerRef, overlay, hasChart }: {
  containerRef: React.RefObject<HTMLDivElement | null>,
  overlay?:React.ReactNode,
  hasChart: boolean,
  isRendering: boolean;
  }) {
  return (
    <section className="chartPanel">
      <div className="chartStage">
        <div ref={containerRef} className={`chartResult ${!hasChart ? "empty" : ""}`} />
        {hasChart && overlay}
      </div>
    </section>
  );
}
