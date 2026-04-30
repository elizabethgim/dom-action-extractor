// src/core/charts/rendering/iframeAdpater.ts  (파일명이 iframeAdpater라면 그대로)
import type { ChartInfo } from "@/core/models/types/chartInfoTypes";

export function iframeAdapter(
  url: string,
  slug = "iframe",
  info?: Partial<Omit<ChartInfo, "chartId" | "sourceType">>
) {
  let iframeEl: HTMLIFrameElement | null = null;
  let mountedContainer: HTMLElement | null = null;

  return {
    id: `iframe:${slug}`,

    mount(container: HTMLElement) {
      mountedContainer = container;

      container.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.src = url;
      iframe.style.width = "100%";
      iframe.style.height = "800px";
      iframe.style.border = "0";
      iframe.setAttribute("loading", "lazy");

      container.appendChild(iframe);
      iframeEl = iframe;
    },

    unmount() {
      if (iframeEl) {
        // iframe 제거
        iframeEl.remove();
        iframeEl = null;
      }
      if (mountedContainer) {
        // 필요하면 container 비우기
        // mountedContainer.innerHTML = "";
        mountedContainer = null;
      }
    },

    getInfo(): ChartInfo {
      return {
        chartId: entry.id,
        sourceType: "iframe",
        title: info?.title ?? "Embedded Visualization",
        description: info?.description ?? "This visualization is loaded via iframe.",
        markdown: info?.markdown,
        tags: info?.tags ?? ["iframe"],
        source: info?.source ?? url,
      };
    },
  };
}