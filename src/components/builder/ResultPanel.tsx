export function ResultPanel({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }){
  return (
  <section className="resultPanel">
    <div className="resultTitle">
    </div>
    <div ref={containerRef} id="chartResult" className="result"/>
  </section>);
}