export default function BuilderPage() {
  return (
    <div className="builder-layout">
      <BuilderSidebar />
      <BuilderCanvas />
      <BuilderInspector />
    </div>
  );
}