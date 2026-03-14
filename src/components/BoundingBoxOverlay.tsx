import { useEffect, useRef } from "react";

import type { ExtractedEl } from "@/types/ExtractedEl";
import "@styles/BoundingBoxOverlay.css";

export function BoundingBoxOverlay({
  items,
  hoverKey,
  selectedKey,
  selectedDataKey,
  onHover,
}: {
  items: ExtractedEl[];
  hoverKey: string | null;
  selectedKey: string | null;
  selectedDataKey: string | null;
  onHover: (k: string | null) => void;
}) {
  // if(!items.length) return null;
  console.log("Overlay Render:", {
    itemsCount: items.length,
    selectedKey,
    hoverKey,
  });

  // 화면에 그릴 타겟들만 필터링 (성능 및 시각적 노이즈 감소)
  const activeItems = items.filter(
    (it) =>
      it.key === hoverKey ||
      it.key === selectedKey ||
      it.key === selectedDataKey,
  );

  const selectedRef = useRef<HTMLDivElement>(null);

  // 스크롤 이동 기능: seletedKey가 바뀔 때 해당 박스로 스크롤
  useEffect(() => {
    if (selectedKey && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedKey]);

  if (!activeItems.length) return null;

  return (
    <div className="overlay">
      {activeItems.map((it) => {
        const isSelected = it.key === selectedKey;
        const isHover = it.key === hoverKey;
        const hasD3Action = it.d3On && it.d3On.length > 0;

        // D3 핸들러가 있는 경우 주황색 계열로 표시
        const activeColor = hasD3Action ? "#f57c00" : "#1a73e8";

        return (
          <div
            key={it.key}
            ref={isSelected ? selectedRef : null}
            className={`box ${isSelected ? "selected" : ""} ${isHover ? "hover" : ""}`}
            style={{
              left: it.bbox.x,
              top: it.bbox.y,
              width: it.bbox.w,
              height: it.bbox.h,
              position: "absolute",
              border: isSelected
                ? `2px solid ${activeColor}`
                : `1px dashed ${activeColor}`,
              backgroundColor: isSelected
                ? "rgba(26, 115, 232, 0.1)"
                : "rgba(26, 115, 232, 0.05)",
              zIndex: isSelected ? 100 : 90,
              transition: "all 0.1s ease",
            }}
          >
            <div className="box-label">
              {it.tag} {hasD3Action ? "⚡" : ""}{" "}
              {it.actionHints.length > 0
                ? `[${it.actionHints.join(", ")}]`
                : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
