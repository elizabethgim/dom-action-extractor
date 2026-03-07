import { useEffect, useMemo, useState } from "react";
import type { ExtractedEl } from "@/types/ExtractedEl";

export function useExtractionState(chartKey: string) {
  const [extracted, setExtracted] = useState<ExtractedEl[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  // ✅ 차트가 바뀌면 이전 결과 무효 → 상태 초기화
  useEffect(() => {
    setExtracted([]);
    setSelectedKey(null);
    setHoverKey(null);
  }, [chartKey]);

  const selected = useMemo(
    () => extracted.find((e) => e.key === selectedKey) ?? null,
    [extracted, selectedKey]
  );

  const overlayTargets = useMemo(() => {
    if (selected) return [selected];
    return extracted;
  }, [selected, extracted]);

  return {
    extracted,
    setExtracted,
    selectedKey,
    setSelectedKey,
    hoverKey,
    setHoverKey,
    selected,
    overlayTargets,
    clear: () => {
      setExtracted([]);
      setSelectedKey(null);
      setHoverKey(null);
    },
  };
}