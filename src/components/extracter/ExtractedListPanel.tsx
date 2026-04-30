import type { ExtractedEl } from "@/types/ExtractedEl";

export function ExtractedListPanel({
  items,
  hoverKey,
  onHover,
}: {
  items: ExtractedEl[];
  hoverKey: string | null;
  onHover: (k: string | null) => void;
}) {
  return (
    <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid #ddd" }}>
      {items.map((it) => (
        <div
          key={it.key}
          onMouseEnter={() => onHover(it.key)}
          onMouseLeave={() => onHover(null)}
          style={{
            padding: "6px 8px",
            background: it.key === hoverKey ? "rgba(0,0,0,0.06)" : "transparent",
            borderBottom: "1px solid #eee",
            cursor: "default",
          }}
        >
          <div style={{ fontSize: 12 }}>
            <b>{it.tag}</b> — {it.selector}
          </div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>
            bbox: ({it.bbox.x.toFixed(1)}, {it.bbox.y.toFixed(1)}) {it.bbox.w.toFixed(1)}×{it.bbox.h.toFixed(1)}
            {"  "} hints: {it.actionHints.join(", ") || "-"}
          </div>
        </div>
      ))}
    </div>
  );
}