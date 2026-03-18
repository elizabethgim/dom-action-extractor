import type { D3OnEntry } from "@/core/actionExtractor/d3On";
import type { ListenerInfo } from "@/core/models/types/ListenerInfo";

export type ExtractedEl = {
  key: string;
  tag: string;
  selector: string;
  bbox: { x: number; y: number; w: number; h: number }; // container 기준 좌표
  depth: number; // DOM depth (대략적인 레이어 느낌)
  actionHints: string[]; // 정적 힌트 기반(추정)
  d3On?: D3OnEntry[]; // d3 __on 함수
  listeners?: ListenerInfo[];
  element: Element;
};
