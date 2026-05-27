// AiRunPanel.tsx
import type { StepLog, StopReason } from "@/core/models/types/aiRun/StepLog";
import "@styles/AiRunPanel.css";

type Props = {
  question: string;
  isRunning: boolean;
  isReplaying?: boolean;
  stopReason: StopReason | null;
  steps: StepLog[];
  lastError?: string | null;

  onRun: () => void;
  onStop: () => void;
  onReset: () => void;
  onReplay?: () => void;
  onStopReplay?: () => void;
};

function statusMeta(isRunning: boolean, stopReason: StopReason | null) {
  if (isRunning) return { label: "Running", icon: "●", tone: "running" as const };
  if (!stopReason) return { label: "Idle", icon: "○", tone: "idle" as const };
  if (stopReason === "ANSWERED") return { label: "Answered", icon: "✓", tone: "success" as const };
  if (stopReason === "ERROR") return { label: "Error", icon: "✕", tone: "error" as const };
  if (stopReason === "USER_STOP") return { label: "Stopped", icon: "■", tone: "warn" as const };
  return { label: stopReason, icon: "•", tone: "idle" as const };
}



export function AiRunPanel(props: Props) {
  const {
    question,
    isRunning,
    stopReason,
    steps,
    lastError,
    onRun,
    onStop,
    onReset,
    onReplay,
    isReplaying,
    onStopReplay,
  } = props;

  const status = statusMeta(isRunning, stopReason);

  const canRun = !!question && !isRunning;
  const canStop = isRunning;
  const canReset = !isRunning && (steps.length > 0 || !!stopReason || !!lastError);


  return (
    <section className="aiPanel aiPanel--answer">
      <div className="aiTop">
        
        <div className="aiTitleRow">
          <h1 className="aiTitle">AI run</h1>
        </div>

        <div className={`aiStatusBlock ${status.tone}`}>
          <span className="aiStatusIcon">{status.icon}</span>
          <span className="aiStatusText">{status.label}</span>
        </div>

        <div className="aiControlsRow">
          <button className="btn primary" onClick={onRun} disabled={!canRun}>
            {isRunning ? "Running…" : "Run"}
          </button>
          <button className="btn secondary" onClick={onStop} disabled={!canStop}>
            Stop
          </button>
          <button className="btn secondary" onClick={onReset} disabled={!canReset}>
            Reset
          </button>

          {onReplay ? (
            <button
              className="btn secondary"
              onClick={onReplay}
              disabled={!steps.length || isRunning || isReplaying}
            >
              Replay
            </button>
          ) : null}

          {onStopReplay ? (
            <button className="btn secondary" onClick={onStopReplay} disabled={!isReplaying}>
              Stop Replay
            </button>
          ) : null}
        </div>


        {lastError ? (
          <div className="aiErrorBox" role="alert">
            <div className="aiErrorTitle">Error</div>
            <pre className="aiErrorBody">{lastError}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}