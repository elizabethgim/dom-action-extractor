// src/core/charts/info/loadChartInfo.ts
import { chartRegistry, type ChartId } from "@/core/charts/chartRegistry";
import type { ChartInfo } from "../models/types/chartInfoTypes";
import { d3InfoMap } from "./d3InfoMap";
import { extractObservableMarkdown, parseMarkdownSummary } from "./observableMd";

/**
 * observable 차트의 모듈을 로드하는 방법은 네 프로젝트에 맞춰 연결해야 함.
 * - 이미 observableAdapter에서 dynamic import 하고 있으면,
 *   그 로더를 여기서 재사용하도록 함수만 주입하는 형태가 가장 깔끔함.
 */
export type ObservableModuleLoader = (chartId: ChartId) => Promise<any>;

// ✅ 너의 기존 observableAdapter 로더를 여기에 연결해줘.
// 임시로 "모듈 로더를 외부에서 set"하는 방식 제공
let observableModuleLoader: ObservableModuleLoader | null = null;

export function setObservableModuleLoader(loader: ObservableModuleLoader) {
  observableModuleLoader = loader;
}

export async function loadChartInfo(chartId: ChartId): Promise<ChartInfo | null> {
  const entry = chartRegistry[chartId];
  if (!entry) return null;

  // 1) registry에 getInfo가 있으면 최우선
  if (entry.getInfo) {
    const base = await entry.getInfo(chartId);
    return {
      chartId,
      sourceType: entry.adapterType,
      title: base.title ?? entry.label ?? chartId,
      description: base.description,
      markdown: base.markdown,
      tags: base.tags,
      source: base.source,
    };
  }

  // 2) adapterType별 기본 로직
  if (entry.adapterType === "d3") {
    const preset = d3InfoMap[chartId];
    if (!preset) {
      return {
        chartId,
        sourceType: "d3",
        title: entry.label ?? chartId,
        description: "No description is defined yet.",
      };
    }
    return {
      chartId,
      sourceType: "d3",
      title: preset.title ?? entry.label ?? chartId,
      description: preset.description,
      markdown: preset.markdown,
      tags: preset.tags,
      source: preset.source,
    };
  }

  // observable
  if (entry.adapterType === "observable") {
    if (!observableModuleLoader) {
      return {
        chartId,
        sourceType: "observable",
        title: entry.label ?? chartId,
        description: "Observable module loader is not set. Call setObservableModuleLoader().",
      };
    }

    const mod = await observableModuleLoader(chartId);
    const markdown = extractObservableMarkdown(mod);
    if (!markdown) {
      return {
        chartId,
        sourceType: "observable",
        title: entry.label ?? chartId,
        description: "No md_1/_1 markdown function found in this Observable module.",
      };
    }

    const { title, description } = parseMarkdownSummary(markdown);
    return {
      chartId,
      sourceType: "observable",
      title: title ?? entry.label ?? chartId,
      description,
      markdown,
      source: "Observable export",
      tags: ["observable"],
    };
  }

  return null;
}