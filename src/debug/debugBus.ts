export type DebugLevel = "INFO" | "WARN" | "ERROR";

export type DebugEvent = {
  ts: number;                 // Date.now()
  level: DebugLevel;
  scope: string;              // "charts/loadChart", "actions/extract", ...
  step?: number;              // 있으면 step 연결
  message: string;
  data?: unknown;             // 구조화 데이터(JSON)
};

type Listener = (e: DebugEvent) => void;

class DebugBus {
  private listeners = new Set<Listener>();

  emit(e: Omit<DebugEvent, "ts">) {
    const evt: DebugEvent = { ts: Date.now(), ...e };
    for (const l of this.listeners) l(evt);
  }

  on(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const debugBus = new DebugBus();

// 편의 함수들
export function dbgInfo(scope: string, message: string, data?: unknown, step?: number) {
  debugBus.emit({ level: "INFO", scope, message, data, step });
}
export function dbgWarn(scope: string, message: string, data?: unknown, step?: number) {
  debugBus.emit({ level: "WARN", scope, message, data, step });
}
export function dbgError(scope: string, message: string, data?: unknown, step?: number) {
  debugBus.emit({ level: "ERROR", scope, message, data, step });
}