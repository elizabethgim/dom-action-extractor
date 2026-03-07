// domCollector.ts
type WaitForRenderOptions = {
  /** container 내부에서 "차트가 랜더되었다"라고 판단할 기준 셀렉터(있으면 훨씬 안정적) */
  readySelector?: string; // e.g. "svg", "canvas", ".echarts", ".highcharts-container"
  /** 변화가 멈춘 뒤 quietMs 동안 추가 변동이 없으면 "완료"로 간주 */
  quietMs?: number;       // default 150 
  /** 최대 대기 시간 */
  timeoutMs?: number;     // default 5000
  /** 요소를 수집할 때 shadowRoot 내부까지 탐색할지 */
  includeShadowDom?: boolean; // default false
  /** finish 전에 raf를 몇 번 기다릴지(페인트 안정화) */
  rafCount?: number;      // default 1
};

function collectElementsDeep(root: Element, includeShadowDom: boolean): Element[] {
  const out: Element[] = [];
  const walk = (node: Element) => {
    out.push(node);

    // 일반 DOM: 자식만 순회(빠르고 중복 적음)
    for (const child of Array.from(node.children)) {
      walk(child);
    }

    // Shadow DOM(옵션): shadowRoot도 "자식만" 동일하게 순회
    if (includeShadowDom) {
      const shadow = (node as any).shadowRoot as ShadowRoot | undefined;
      if (shadow) {
        for (const child of Array.from(shadow.children)) {
          walk(child);
        }
      }
    }
  };

  walk(root);
  return out;
}

function waitRafs(count: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => {
      if (n <= 0) return resolve();
      requestAnimationFrame(() => step(n - 1));
    };
    step(count);
  });
}

/** * container 내부 DOM 변화가 "안정화"되면(container에 chart가 그려졌다고 볼 수 있는 시점) 
 * container 하위의 모든 Element를 반환 */
export function waitChartMountedAndGetAllElements(
  container: HTMLDivElement,
  opts: WaitForRenderOptions = {}
): Promise<Element[]> {
  const {
    readySelector,
    quietMs = 150,
    timeoutMs = 5000,
    includeShadowDom = false,
    rafCount = 1,
  } = opts;

  return new Promise((resolve, reject) => {
    let done = false;
    let quietTimer: number | null = null;
    let timeoutTimer: number | null = null;

    const observer = new MutationObserver(() => {
      // readySelector 조건 충족 전에는 종료 조건을 잡지 않음
      if (!isReady()) return;

      // 변화가 들어올 때마다 quietTimer 리셋 → quietMs 동안 추가 변화 없으면 완료로 간주
      if (quietTimer) window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => void finish(), quietMs);
    });

    const cleanup = () => {
      if (quietTimer) window.clearTimeout(quietTimer);
      if (timeoutTimer) window.clearTimeout(timeoutTimer);
      if(observer) observer.disconnect();
      quietTimer = null;
      timeoutTimer = null;
    };

    const finish = async () => {
      if (done) return;
      done = true;
      cleanup();

      // 레이아웃/페인트 안정화
      await waitRafs(rafCount);

      return resolve(collectElementsDeep(container, includeShadowDom));
    };

    const fail = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error(`Timed out waiting for chart to mount within ${timeoutMs}ms`));
    };

    const isReady = () =>
      !readySelector || !!container.querySelector(readySelector);

    // 이미 ready면 quiet 보장 없이 바로 finish하지 말고 raf 안정화 후 수집
    if (isReady()) {
      // 차트가 이미 그려진 상태이지만 한 번 더 quietMs만큼 대기
      quietTimer = window.setTimeout(() => void finish(), quietMs);
      timeoutTimer = window.setTimeout(fail, timeoutMs);
      // 필요하면 여기서도 quietMs를 적용할지 정책 선택 가능.
      void finish();
      return;
    }

    

    observer.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: false,
    });

    // 혹시 ready가 microtask 사이에 충족되면 quiet 타이머 걸어주기
    queueMicrotask(() => {
      if (done) return;
      if (isReady()) {
        if (quietTimer) window.clearTimeout(quietTimer);
        quietTimer = window.setTimeout(() => void finish(), quietMs);
      }
    });

    timeoutTimer = window.setTimeout(fail, timeoutMs);
  });
}