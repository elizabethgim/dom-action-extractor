import type { ExtractedEl } from "@/types/ExtractedEl";
import { useMemo, useState } from "react";

type SortKey = "tag" | "area" | "depth" | "actions";
type SortDir = "asc" | "desc";

export function useExtractionPanel(extracted: ExtractedEl[]) {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("area");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [onlyActionable, setOnlyActionable] = useState(false);

  const tags = useMemo(() => {
    const s = new Set(extracted.map((e) => e.tag));
    return ["all", ...Array.from(s).sort()];
  }, [extracted]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const area = (e: ExtractedEl) => Math.max(0, e.bbox.w) * Math.max(0, e.bbox.h);
    const hasAction = (e: ExtractedEl) => (e.actionHints?.length ?? 0) > 0;

    let r = extracted.filter((e) => {
      if (tagFilter !== "all" && e.tag !== tagFilter) return false;
      if (onlyActionable && !hasAction(e)) return false;

      if (!q) return true;
      return (
        e.selector.toLowerCase().includes(q) ||
        e.tag.toLowerCase().includes(q) ||
        e.actionHints.join(" ").toLowerCase().includes(q)
      );
    });

    // 정렬
    r.sort((a, b) => {
      const av =
        sortKey === "tag" ? a.tag 
        : sortKey === "depth" ? a.depth 
        : sortKey === "actions" ? (hasAction(a) ? 1 : 0)
        : area(a);

      const bv =
        sortKey === "tag" ? b.tag 
        : sortKey === "depth" ? b.depth 
        : sortKey === "actions" ? (hasAction(b) ? 1 : 0)
        : area(b);

      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv);
      else cmp = (av as number) - (bv as number);

      return sortDir === "asc" ? cmp : -cmp;
    });

    return r;
  }, [extracted, query, tagFilter, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  };

  return {
    // state
    query,
    setQuery,

    tagFilter,
    setTagFilter,
    
    sortKey,
    sortDir,

    onlyActionable,
    setOnlyActionable,

    // derived
    tags,
    rows,
    
    toggleSort    
  };
}