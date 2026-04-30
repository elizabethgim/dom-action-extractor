// actionProbe.ts

export type ActionType =
  | "click"
  | "dblclick"
  | "mousemove"
  | "mouseenter"
  | "mouseleave"
  | "mousedown"
  | "mouseup"
  | "wheel"
  | string;

export interface ProbeOptions {
  type?: ActionType;
  clientX?: number;
  clientY?: number;
  wheelDeltaY?: number;
  waitMs?: number;
}

export interface ElementSnapshot {
  html: string;
  text: string;
  bbox: DOMRect | null;
  svgTextCount: number;
  svgPathCount: number;
  svgCircleCount: number;
  svgRectCount: number;
  tooltipTexts: string[];
  visibleTextSample: string[];
}

export interface ProbeDiff {
  changed: boolean;
  htmlChanged: boolean;
  bboxChanged: boolean;
  markCountChanged: boolean;
  tooltipChanged: boolean;
  textChanged: boolean;
  changeHints: string[];
}

export interface ProbeResult {
  actionType: string;
  targetSummary: string;
  before: ElementSnapshot;
  after: ElementSnapshot;
  diff: ProbeDiff;
}

export function summarizeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
  const clsRaw = (el as HTMLElement).className?.toString?.() || "";
  const cls = clsRaw.trim()
    ? "." + clsRaw.trim().split(/\s+/).slice(0, 3).join(".")
    : "";

  const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50);
  return `${tag}${id}${cls}${text ? ` text="${text}"` : ""}`;
}

export function getElementCenter(el: Element) {
  const rect = (el as HTMLElement).getBoundingClientRect();
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
}

export async function probeAction(
  el: Element,
  options: ProbeOptions = {}
): Promise<ProbeResult> {
  const type = options.type ?? "click";
  const center = getElementCenter(el);

  const clientX = options.clientX ?? center.clientX;
  const clientY = options.clientY ?? center.clientY;
  const wheelDeltaY = options.wheelDeltaY ?? 120;
  const waitMs = options.waitMs ?? 120;

  const root = findChartRoot(el) ?? (el.ownerDocument?.body || document.body);

  const before = snapshotChart(root);

  // 1) dispatchEvent 먼저 시도
  dispatchSyntheticEvent(el, type, { clientX, clientY, wheelDeltaY });

  // 2) d3 __on 직접 호출도 시도
  runD3On(el, type, { clientX, clientY, wheelDeltaY });

  // 변화 반영 기다리기
  await sleep(waitMs);

  const after = snapshotChart(root);
  const diff = diffSnapshots(before, after);

  return {
    actionType: type,
    targetSummary: summarizeElement(el),
    before,
    after,
    diff,
  };
}

/* -----------------------------
 * D3 direct execution
 * ----------------------------- */

export function runD3On(
  el: Element,
  type?: string,
  options?: { clientX?: number; clientY?: number; wheelDeltaY?: number }
) {
  const arr = (el as any).__on as any[] | undefined;
  if (!Array.isArray(arr) || arr.length === 0) return;

  const data = (el as any).__data__;
  const targets = type ? arr.filter((x) => x?.type === type) : arr;

  for (const h of targets) {
    const fn = h?.value;
    if (typeof fn !== "function") continue;

    const ev = makeEvent(h.type, options, el);
    fn.call(el, ev, data);
  }
}

/* -----------------------------
 * Native synthetic dispatch
 * ----------------------------- */

export function dispatchSyntheticEvent(
  el: Element,
  type: string,
  options?: { clientX?: number; clientY?: number; wheelDeltaY?: number }
) {
  const ev = makeEvent(type, options, el);
  el.dispatchEvent(ev);
}

function makeEvent(
  type: string,
  options?: { clientX?: number; clientY?: number; wheelDeltaY?: number },
  el?: Element
): Event {
  const clientX = options?.clientX ?? 0;
  const clientY = options?.clientY ?? 0;
  const deltaY = options?.wheelDeltaY ?? 120;

  const common = {
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  if (
    type === "click" ||
    type === "dblclick" ||
    type === "mousedown" ||
    type === "mouseup" ||
    type === "mousemove" ||
    type === "mouseenter" ||
    type === "mouseleave" ||
    type.startsWith("mouse")
  ) {
    return new MouseEvent(type, {
      ...common,
      clientX,
      clientY,
      view: el?.ownerDocument?.defaultView || window,
    });
  }

  if (type === "wheel") {
    return new WheelEvent("wheel", {
      ...common,
      clientX,
      clientY,
      deltaY,
      view: el?.ownerDocument?.defaultView || window,
    });
  }

  return new Event(type, common);
}

/* -----------------------------
 * Snapshot
 * ----------------------------- */

export function snapshotChart(root: Element): ElementSnapshot {
  const html = root.innerHTML;
  const text = normalizeText(root.textContent || "");
  const bbox = safeBBox(root as HTMLElement);

  const svg = root.querySelector("svg");
  const svgTextCount = svg ? svg.querySelectorAll("text").length : 0;
  const svgPathCount = svg ? svg.querySelectorAll("path").length : 0;
  const svgCircleCount = svg ? svg.querySelectorAll("circle").length : 0;
  const svgRectCount = svg ? svg.querySelectorAll("rect").length : 0;

  const tooltipTexts = collectTooltipTexts(root);
  const visibleTextSample = collectVisibleTextSample(root, 20);

  return {
    html,
    text,
    bbox,
    svgTextCount,
    svgPathCount,
    svgCircleCount,
    svgRectCount,
    tooltipTexts,
    visibleTextSample,
  };
}

function safeBBox(el: HTMLElement): DOMRect | null {
  try {
    return el.getBoundingClientRect();
  } catch {
    return null;
  }
}

function collectTooltipTexts(root: Element): string[] {
  const candidates = Array.from(
    root.querySelectorAll(
      [
        "[role='tooltip']",
        ".tooltip",
        ".d3-tooltip",
        ".chart-tooltip",
        ".vega-tooltip",
        ".observablehq--inspect",
        "[class*='tooltip']",
      ].join(",")
    )
  );

  return candidates
    .map((x) => normalizeText(x.textContent || ""))
    .filter(Boolean)
    .slice(0, 10);
}

function collectVisibleTextSample(root: Element, limit = 20): string[] {
  const texts = Array.from(root.querySelectorAll("text, div, span"))
    .map((el) => normalizeText(el.textContent || ""))
    .filter(Boolean);

  return unique(texts).slice(0, limit);
}

/* -----------------------------
 * Diff
 * ----------------------------- */

export function diffSnapshots(
  before: ElementSnapshot,
  after: ElementSnapshot
): ProbeDiff {
  const htmlChanged = before.html !== after.html;
  const textChanged = before.text !== after.text;

  const bboxChanged =
    !before.bbox ||
    !after.bbox ||
    Math.abs(before.bbox.width - after.bbox.width) > 1 ||
    Math.abs(before.bbox.height - after.bbox.height) > 1;

  const markCountChanged =
    before.svgTextCount !== after.svgTextCount ||
    before.svgPathCount !== after.svgPathCount ||
    before.svgCircleCount !== after.svgCircleCount ||
    before.svgRectCount !== after.svgRectCount;

  const tooltipChanged =
    JSON.stringify(before.tooltipTexts) !== JSON.stringify(after.tooltipTexts);

  const changeHints: string[] = [];

  if (tooltipChanged) changeHints.push("tooltip_changed");
  if (markCountChanged) changeHints.push("mark_structure_changed");
  if (textChanged) changeHints.push("text_changed");
  if (htmlChanged) changeHints.push("dom_changed");
  if (bboxChanged) changeHints.push("layout_changed");

  // 조금 더 의미적인 힌트
  if (!before.tooltipTexts.length && after.tooltipTexts.length) {
    changeHints.push("tooltip_appeared");
  }

  if (before.svgPathCount !== after.svgPathCount) {
    changeHints.push("path_count_changed");
  }

  if (before.svgRectCount !== after.svgRectCount) {
    changeHints.push("rect_count_changed");
  }

  if (before.svgCircleCount !== after.svgCircleCount) {
    changeHints.push("circle_count_changed");
  }

  if (before.svgTextCount !== after.svgTextCount) {
    changeHints.push("text_mark_count_changed");
  }

  const changed =
    htmlChanged || bboxChanged || markCountChanged || tooltipChanged || textChanged;

  return {
    changed,
    htmlChanged,
    bboxChanged,
    markCountChanged,
    tooltipChanged,
    textChanged,
    changeHints,
  };
}

/* -----------------------------
 * Helpers
 * ----------------------------- */

function findChartRoot(el: Element): Element | null {
  let cur: Element | null = el;
  while (cur) {
    if (
      cur.matches?.(
        "[data-chart-root], .chart-container, .chart-root, svg, figure"
      )
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

function normalizeText(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}