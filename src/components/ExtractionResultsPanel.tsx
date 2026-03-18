import { useExtractionPanel } from "@hooks/useExtractionPanel";
import type { ExtractedEl } from "@/types/ExtractedEl";

import "@styles/ExtractionResultsPanel.css";

type Props = {
  extracted: ExtractedEl[];
  selectedKey?: string | null;
  onSelect?: (key: string) => void;
  onClear?: () => void;
  onRunD3?: (key: string, type?: string) => void;
};

export function ExtractionResultsPanel({
  extracted,
  selectedKey,
  onSelect,
  onClear,
  onRunD3,
}: Props) {
  const {
    query,
    setQuery,
    tagFilter,
    setTagFilter,
    sortKey,
    sortDir,

    tags,
    rows,

    toggleSort,

    onlyActionable,
    setOnlyActionable
  } = useExtractionPanel(extracted);

  const selected = extracted.find((e) => e.key === selectedKey) ?? null;
  const handlers = selected?.d3On ?? [];
  const nativeListeners = selected?.listeners??[];

  return (
    <div className="extractionResultsPanel">
      <div className="erpHeaderRow">
        <div className="erpTitle">
          Extracted Elements{" "}
          <span className="erpCount">({rows.length}/{extracted.length})</span>
        </div>
        <div className="erpHeaderActions">
          <button type="button" onClick={onClear} disabled={!extracted.length}>
            Clear
          </button>
        </div>
      </div>

      <div className="erpControls">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search selector / tag / hints…"
          onKeyDown={(e) => {
            if(e.key === "Escape") setQuery("");
          }}
        />
        

        <div className="erpFilterGroup">
          <label className="erpActionableToggle" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={onlyActionable}
              onChange={(e) => setOnlyActionable(e.target.checked)}
            />
            <span>Only Actionable (D3)</span>
          </label>
          
          <label>Tag: </label>
            <select
              className="resultsSelect"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        

        <div className="erpSorts">
          <button type="button" onClick={() => toggleSort("area")}>
            Area {sortKey === "area" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button type="button" onClick={() => toggleSort("depth")}>
            Depth {sortKey === "depth" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button type="button" onClick={() => toggleSort("tag")}>
            Tag {sortKey === "tag" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
          <button type="button" onClick={() => toggleSort("actions")}>
            Actions {sortKey === "actions" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </button>
        </div>
      </div>

      <div className="erpTableWrap">
        <table className="erpTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Tag</th>
              <th>Selector</th>
              <th>BBox</th>
              <th>Area</th>
              <th>Depth</th>
              <th>Hints</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((e, i) => {
              const area = Math.round(e.bbox.w * e.bbox.h);
              const selected = selectedKey === e.key;
              const actionsCount = e.d3On?.length ?? 0;
              const hasAction = actionsCount > 0;

              return (
                <tr
                  key={e.key}
                  className={selected ? "isSelected" : ""}
                  onClick={() => onSelect?.(e.key)}
                  title="Click to select"
                >
                  <td>{i + 1}</td>
                  <td>
                    <code>{e.tag}</code>
                  </td>
                  <td className="erpSelectorCell">
                    <code>{e.selector}</code>
                  </td>
                  <td className="erpBboxCell">
                    <code>
                      {Math.round(e.bbox.x)},{Math.round(e.bbox.y)}{" "}
                      {Math.round(e.bbox.w)}×{Math.round(e.bbox.h)}
                    </code>
                  </td>
                  <td>{area}</td>
                  <td>{e.depth}</td>
                  <td className="erpHintsCell">{e.actionHints?.join(", ")}</td>
                  <td>
                    {hasAction ? (
                      <span title={`${actionsCount} handlers`}>✅ {actionsCount}</span>
                    ) : (
                      <span title="No handlers">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td colSpan={8} className="erpEmpty">
                  No results
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="d3Panel">
          <h4 className="d3Title">
            D3 __on handlers ({handlers.length})
          </h4>

          {handlers.length === 0 ? (
            <div className="d3Empty">No __on handlers</div>
          ) : (
            handlers.map((h, i) => (
              <div key={i} className="d3Card">
                <div className="d3CardHeader">
                  <div className="d3Meta">
                    <b>{h.type}</b>
                    {h.name && <span className="d3Ns">ns:{h.name}</span>}
                    <span className="d3Fn">{h.fnName}</span>
                  </div>

                  <div className="d3Actions">
                    <button
                      className="btn secondary"
                      onClick={() => onRunD3?.(selected.key, h.type)}
                    >
                      Run {h.type}
                    </button>

                    <button
                      className="btn secondary"
                      onClick={() => onRunD3?.(selected.key)}
                    >
                      Run all
                    </button>
                  </div>
                </div>

                <pre className="d3Source">
                  {h.source}
                </pre>
              </div>
            ))
          )}
        </div>
      )}

      <div className="detailSection">
        <h4>Native Event Listeners</h4>
        {nativeListeners.length === 0 ? (
          <div className="empty">No listeners detected</div>
        ) : (
          <ul className="listenerList">
            {nativeListeners.map((listener, idx) => (
              <li key={`${listener.eventType}-${listener.name}-${idx}`} className="listenerItem">
                <div><strong>event:</strong> {listener.eventType}</div>
                <div><strong>name:</strong> {listener.name}</div>
                <div><strong>type:</strong> {listener.handlerType}</div>
                <pre>{listener.source}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}