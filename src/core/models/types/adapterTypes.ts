import type { ChartInfo } from "@/core/models/types/chartInfoTypes";

export type ChartEntry = {
  adapterType: "d3" | "observable" | "iframe";
  slug?: string;  // adapter에 넘기는 "collapsible-tree" 같은 값
  render: (container: HTMLElement) => Promise<void> | void;

  getInfo?: (chartId: string) => Promise<ChartInfo> | ChartInfo;
};