import type { ExtractedEl } from "@/types/ExtractedEl";
import "@styles/BoundingBoxOverlay.css";

export function BoundingBoxOverlay({
  items,
  hoverKey,
  onHover,
}: {
  items: ExtractedEl[];
  hoverKey: string | null;
  onHover: (k: string | null) => void;
}) {
  if(!items.length) return null;
  return (
    <div className="overlay">
      {items.map((it) => (
        <div
          key={it.key}
          className={`box ${it.key === hoverKey ? "hover" : ""}`}
          style={{
            left: it.bbox.x,
            top: it.bbox.y,
            width: it.bbox.w,
            height: it.bbox.h,
          }}
        />
      ))}
    </div>
  );
}