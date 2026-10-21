import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { listAiRuns, type AiRunSummary } from "@/api/aiRunApi";
import { useChartCatalog } from "@/hooks/useChartMeta";

import "@styles/global.css";
import "@styles/RunLogTestPage.css";

function formatTime(timestamp: string) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString();
}

function RunLogTestPage() {
  const navigate = useNavigate();
  const { charts: chartCatalog } = useChartCatalog();

  const [runs, setRuns] = useState<AiRunSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    listAiRuns()
      .then((data) => {
        if (!cancelled) setRuns(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(String(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="runLogPage">
      <h2>저장된 Step Log 목록</h2>

      {isLoading && <p className="muted">불러오는 중...</p>}
      {loadError && <p style={{ color: "var(--color-danger, crimson)" }}>{loadError}</p>}
      {!isLoading && !loadError && runs.length === 0 && (
        <p className="muted">저장된 run이 없습니다.</p>
      )}

      <table className="runLogTable">
        <thead>
          <tr>
            <th>생성 시각</th>
            <th>차트</th>
            <th>질문</th>
            <th>종료 사유</th>
            <th>스텝 수</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const chartTitle = chartCatalog.find((c) => c.id === run.chartId)?.title ?? run.chartId;

            return (
              <tr key={run.id}>
                <td>{formatTime(run.createdAt)}</td>
                <td>{chartTitle}</td>
                <td>{run.questionText}</td>
                <td>{run.stopReason ?? "-"}</td>
                <td>{run.stepCount}</td>
                <td>
                  <button onClick={() => navigate(`/animation?runId=${run.id}`)}>
                    재생/테스트
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default RunLogTestPage;
