import type { ChartInfo } from "../models/types/chartInfoTypes";
import { d3InfoMap } from "../info/d3InfoMap";

export function d3Adapter(render: (container: HTMLElement) => void, id: string) {  
  return {
    id,
    async mount(container: HTMLElement) {
      render(container);
    },
    async unmount(container: HTMLElement) {
      container.innerHTML = "";
    },
    getInfo(chartId: string): ChartInfo {
      const preset = d3InfoMap[chartId];
      return {
        chartId,
        sourceType: "d3",
        title: preset?.title ?? id,
        description: preset?.description ?? "No description defined yet.",
        markdown: preset?.markdown,
        tags: preset?.tags,
        source: preset?.source,
      };
    },
  };
}