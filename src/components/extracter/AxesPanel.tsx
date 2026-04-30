import type { IAxis } from "@/core/models/interface/IAxis";
import "@styles/AxesPanel.css";

type AxisPanelProps = {
  title?: string;
  axis: IAxis[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
};

export function AxisPanel({
  title = "Axis Panel",
  axis,
  selectedIndex = null,
  onSelect,
}: AxisPanelProps) {
  return (
    <section className="AxisPanel">
      <div className="axisTitle">{title}</div>
      <div>Total ticks: {axis.length}</div>

      {/* {axis.length === 0 ? (
        <div className="axisEmpty">No axis detected</div>
      ) : (
        <ul className="axisList">
          {axis.map((tick, idx) => (
            <li
              key={idx}
              className={`axisItem ${
                selectedIndex === idx ? "selected" : ""
              }`}
              onClick={() => onSelect?.(idx)}
            >
              <div className="axisText">{tick.text || "(empty)"}</div>

              <div className="axisMeta">
                left: {tick.bbox.left.toFixed(1)} | top: {tick.bbox.top.toFixed(1)}
              </div>

              <div className="axisBBox">
                bbox: {tick.bbox.width.toFixed(1)} × {tick.bbox.height.toFixed(1)}
              </div>

            </li>
          ))}
        </ul>
      )} */}

      <div className="axisTableWrap">
        <table className="axisTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Text</th>
              <th>Left</th>
              <th>Top</th>
              <th>Width</th>
              <th>Height</th>
            </tr>
          </thead>

          <tbody>
            {axis.length === 0 ? (
              <tr>
                <td colSpan={6} className="axisEmptyRow">
                  No axis detected
                </td>
              </tr>
            ) : (
              axis.map((tick, idx) => (
                <tr
                  key={`${tick.text}-${idx}`}
                  className={selectedIndex === idx ? "selelcted" : ""}
                  onClick={() => onSelect?.(idx)}
                >
                  <td>{idx}</td>
                  <td>{tick.text}</td>
                  <td>{tick.bbox.left.toFixed(1)}</td>
                  <td>{tick.bbox.top.toFixed(1)}</td>
                  <td>{tick.bbox.width.toFixed(1)}</td>
                  <td>{tick.bbox.height.toFixed(1)}</td>                  
                </tr>
              ))
            )}
          </tbody>
        </table>

      </div>
    </section>
  );
}