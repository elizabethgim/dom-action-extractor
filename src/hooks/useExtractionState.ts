import { useEffect, useMemo, useState } from "react";
import type { ExtractedEl } from "@/types/ExtractedEl";

export function useExtractionState(chartKey: string) {
  const [extracted, setExtracted] = useState<ExtractedEl[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dataExtracted, setDataExtracted] = useState<ExtractedEl[]>([]);
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(null);

  // ✅ 차트가 바뀌면 이전 결과 무효 → 상태 초기화
  useEffect(() => {
    setExtracted([]);
    setDataExtracted([]);
    setSelectedKey(null);
    setHoverKey(null);
  }, [chartKey]);

  const selected = useMemo(
    () => extracted.find((e) => e.key === selectedKey) ?? null,
    [extracted, selectedKey],
  );

  const selectedData = useMemo(
    () => dataExtracted.find((e) => e.key === selectedDataKey) ?? null,
    [dataExtracted, selectedDataKey],
  );

  const overlayTargets = useMemo(() => {
    if (selected) return [selected];

    if (selectedData) return [selectedData];

    return extracted;
  }, [selected, selectedData, extracted ]);

  return {
    extracted,
    setExtracted,
    selectedKey,
    setSelectedKey,
    hoverKey,
    setHoverKey,
    selected,
    dataExtracted,
    setDataExtracted,
    selectedDataKey,
    setSelectedDataKey,
    overlayTargets,
    clear: () => {
      setExtracted([]);
      setDataExtracted([]);
      setSelectedKey(null);
      setHoverKey(null);
    },
  };
}
