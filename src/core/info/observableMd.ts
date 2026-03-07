// src/core/charts/info/observableMd.ts
/**
 * Observable export에서 markdown을 뽑기 위한 유틸.
 * - md_1 / _1 같은 함수가 (md) => md`...` 형태인 경우를 지원
 * - DOM/객체가 values로 섞이면 안전하게 stringify
 */

type MdTag = (strings: TemplateStringsArray, ...values: any[]) => string;

export function mdToStringTag(): MdTag {
  return (strings, ...values) => {
    let out = "";
    for (let i = 0; i < strings.length; i++) {
      out += strings[i] ?? "";
      if (i < values.length) out += safeToText(values[i]);
    }
    return out;
  };
}

function safeToText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  // URL / Date 등
  if (v instanceof Date) return v.toISOString();
  if (typeof v?.toString === "function" && v.toString !== Object.prototype.toString) {
    try {
      const s = v.toString();
      if (typeof s === "string" && s !== "[object Object]") return s;
    } catch {}
  }

  // DOM Node처럼 보이면 텍스트 대체
  if (typeof v === "object" && (v.nodeType === 1 || v.nodeType === 9)) {
    return ""; // DOM 노드는 markdown에 넣기 애매해서 일단 제거
  }

  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

/**
 * Observable 모듈에서 markdown 생성 함수 이름을 찾는다.
 * 우선순위: md_1 -> _1 -> 기타 후보
 */
export function findObservableMdFn(mod: any): ((md: MdTag) => any) | null {
  if (!mod) return null;

  // 가장 흔한 케이스
  if (typeof mod.md_1 === "function") return mod.md_1;
  if (typeof mod._1 === "function") return mod._1;

  // 혹시 export 이름이 다르게 나간 경우 후보 스캔
  for (const key of Object.keys(mod)) {
    if (!key) continue;
    if (key.startsWith("md_") && typeof mod[key] === "function") return mod[key];
  }

  return null;
}

/**
 * Observable 모듈에서 markdown string을 추출한다.
 */
export function extractObservableMarkdown(mod: any): string | null {
  const fn = findObservableMdFn(mod);
  if (!fn) return null;

  const md = mdToStringTag();
  try {
    const result = fn(md);
    // 우리가 md를 string으로 만들었기 때문에 보통 string
    if (typeof result === "string") return result;
    // 혹시 다른 형태면 마지막으로 stringify
    return typeof result === "undefined" ? null : String(result);
  } catch (e) {
    console.warn("extractObservableMarkdown failed:", e);
    return null;
  }
}

/**
 * markdown에서 title/description을 대충 추출(옵션).
 * - 첫 번째 # Heading을 title로
 * - 나머지 첫 문단을 description으로
 */
export function parseMarkdownSummary(markdown: string): { title?: string; description?: string } {
  const lines = markdown.split(/\r?\n/);

  let title: string | undefined;
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)\s*$/);
    if (m) {
      title = m[1].trim();
      break;
    }
  }

  // description: heading 이후 첫 non-empty paragraph
  let desc = "";
  let seenHeading = false;
  for (const line of lines) {
    if (!seenHeading && /^#\s+/.test(line)) {
      seenHeading = true;
      continue;
    }
    if (!seenHeading) continue;

    const t = line.trim();
    if (!t) {
      if (desc) break;
      continue;
    }
    // 코드블록/리스트는 제외하고 싶으면 여기에서 조건 추가 가능
    desc += (desc ? " " : "") + t;
    if (desc.length > 240) break;
  }

  return {
    title,
    description: desc || undefined,
  };
}