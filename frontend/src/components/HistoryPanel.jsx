import React, { useState } from "react";

const Dot = ({ color, size = 6 }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

function fmtTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  if (diff < 604800000) return Math.floor(diff / 86400000) + "d ago";
  return d.toLocaleDateString();
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

export default function HistoryPanel({ history, onReplay, onDelete, onClear, providers }) {
  const [expanded, setExpanded] = useState(null);

  if (history.length === 0) {
    return (
      <div style={{ padding: "20px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>&#128203;</div>
        <div style={{ fontSize: 12, color: "#555" }}>No runs yet. Results will appear here after your first run.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 6px" }}>
        <span style={{ fontSize: 11, color: "#555" }}>{history.length} run{history.length !== 1 ? "s" : ""}</span>
        <button
          onClick={onClear}
          style={{ fontSize: 10.5, color: "#555", background: "none", border: "1px solid #22222e", padding: "3px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}
        >
          Clear All
        </button>
      </div>

      {history.map((h) => {
        const prov = providers.find((p) => p.id === h.provider);
        const isExpanded = expanded === h.id;
        const isCompare = h.type === "compare";

        return (
          <div
            key={h.id}
            style={{
              background: "#12121a", borderRadius: 10, border: "1px solid #1a1a24",
              overflow: "hidden", transition: "all .15s",
            }}
          >
            {/* Summary row */}
            <button
              onClick={() => setExpanded(isExpanded ? null : h.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "9px 12px", border: "none", background: "transparent",
                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 13 }}>{h.taskIcon || "?"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isCompare ? (
                    <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>Compare ({h.modelCount})</span>
                  ) : (
                    <>
                      <Dot color={prov?.color || "#666"} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: prov?.color || "#888" }}>{h.modelName || h.model}</span>
                    </>
                  )}
                  <span style={{ fontSize: 10, color: "#444" }}>{fmtTime(h.ts)}</span>
                </div>
                <div style={{ fontSize: 11, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                  {truncate(h.input, 80)}
                </div>
              </div>
              {h.latency && <span style={{ fontSize: 10, color: "#444" }}>{h.latency}ms</span>}
              <span style={{ fontSize: 9, color: "#444", transform: isExpanded ? "rotate(180deg)" : "", transition: "transform .15s" }}>&#9662;</span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{ padding: "0 12px 10px", borderTop: "1px solid #1a1a24", animation: "fadeIn .2s" }}>
                <div style={{ fontSize: 11, color: "#666", marginTop: 8, marginBottom: 4, fontWeight: 600 }}>Input</div>
                <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.5, maxHeight: 80, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "6px 8px", background: "#0e0e14", borderRadius: 6 }}>
                  {h.input}
                </div>

                {h.output && (
                  <>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 8, marginBottom: 4, fontWeight: 600 }}>Output</div>
                    <div style={{ fontSize: 11.5, color: "#999", lineHeight: 1.5, maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", padding: "6px 8px", background: "#0e0e14", borderRadius: 6 }}>
                      {truncate(h.output, 500)}
                    </div>
                  </>
                )}

                {h.usage && (
                  <div style={{ fontSize: 10.5, color: "#555", marginTop: 6 }}>
                    Tokens: &uarr;{h.usage.input_tokens} &darr;{h.usage.output_tokens}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => onReplay(h)}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #2a2a35", background: "transparent", color: "#888", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                  >
                    Replay
                  </button>
                  <button
                    onClick={() => { onDelete(h.id); if (isExpanded) setExpanded(null); }}
                    style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid #2a1520", background: "transparent", color: "#f87171", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
