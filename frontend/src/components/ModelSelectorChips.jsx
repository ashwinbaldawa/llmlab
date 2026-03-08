import React, { useState, useRef, useEffect } from "react";

const Dot = ({ color, size = 7 }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

export default function ModelSelectorChips({ selected, onChange, providers, providerModels, fetchModels, maxModels = 4 }) {
  const [open, setOpen] = useState(false);
  const [activeProv, setActiveProv] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setActiveProv(null); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const addModel = (provId, modId) => {
    if (selected.length >= maxModels) return;
    if (selected.some((s) => s.provider === provId && s.model === modId)) return;
    onChange([...selected, { provider: provId, model: modId }]);
    setOpen(false);
    setActiveProv(null);
  };

  const removeModel = (idx) => {
    onChange(selected.filter((_, i) => i !== idx));
  };

  return (
    <div ref={ref} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {selected.map((s, i) => {
        const prov = providers.find((p) => p.id === s.provider);
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 8px",
            background: (prov?.color || "#6366f1") + "12", border: "1px solid " + (prov?.color || "#6366f1") + "30",
            borderRadius: 8, fontSize: 11.5,
          }}>
            <Dot color={prov?.color || "#6366f1"} />
            <span style={{ color: prov?.color || "#6366f1", fontWeight: 600 }}>{prov?.name || s.provider}</span>
            <span style={{ color: "#555" }}>/</span>
            <span style={{ color: "#bbb" }}>{s.model}</span>
            <button
              onClick={() => removeModel(i)}
              style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: "0 2px", marginLeft: 2 }}
            >x</button>
          </div>
        );
      })}

      {selected.length < maxModels && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              padding: "5px 12px", borderRadius: 8, border: "1px dashed #333",
              background: "transparent", color: "#666", cursor: "pointer",
              fontFamily: "inherit", fontSize: 11.5, transition: "all .15s",
            }}
          >
            + Add Model
          </button>

          {open && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
              display: "flex", animation: "ddIn .15s ease-out",
            }}>
              <div style={{
                background: "#141419", border: "1px solid #222230",
                borderRadius: activeProv ? "12px 0 0 12px" : 12,
                boxShadow: activeProv ? "none" : "0 16px 50px rgba(0,0,0,.6)",
                width: 190, overflow: "hidden",
              }}>
                <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #1c1c28" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#555" }}>Provider</div>
                </div>
                <div style={{ padding: 4, maxHeight: 300, overflowY: "auto" }}>
                  {providers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProv(activeProv === p.id ? null : p.id); fetchModels(p.id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8, width: "100%",
                        padding: "7px 10px", border: "none", borderRadius: 7, cursor: "pointer",
                        fontFamily: "inherit", fontSize: 12, textAlign: "left",
                        background: activeProv === p.id ? p.color + "15" : "transparent",
                        color: activeProv === p.id ? p.color : "#aaa",
                        borderLeft: activeProv === p.id ? `2px solid ${p.color}` : "2px solid transparent",
                      }}
                      onMouseEnter={(e) => { if (activeProv !== p.id) e.currentTarget.style.background = "#1e1e2a"; }}
                      onMouseLeave={(e) => { if (activeProv !== p.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <Dot color={p.color} />
                      <span style={{ flex: 1, fontWeight: activeProv === p.id ? 600 : 400 }}>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {activeProv && (() => {
                const p = providers.find((x) => x.id === activeProv);
                const pModels = providerModels[activeProv] || [];
                return (
                  <div style={{
                    background: "#141419", borderTop: "1px solid #222230", borderRight: "1px solid #222230", borderBottom: "1px solid #222230",
                    borderRadius: "0 12px 12px 0", boxShadow: "0 16px 50px rgba(0,0,0,.6)",
                    width: 240, overflow: "hidden",
                  }}>
                    <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #1c1c28" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: p.color, textTransform: "uppercase", letterSpacing: ".06em" }}>{p.name} Models</div>
                    </div>
                    <div style={{ padding: 4, maxHeight: 300, overflowY: "auto" }}>
                      {pModels.length === 0 && <div style={{ padding: 10, fontSize: 11, color: "#555" }}>Loading...</div>}
                      {pModels.map((m) => {
                        const already = selected.some((s) => s.provider === p.id && s.model === m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => !already && addModel(p.id, m.id)}
                            disabled={already}
                            style={{
                              display: "flex", alignItems: "center", gap: 6, width: "100%",
                              padding: "6px 10px", border: "none", borderRadius: 7,
                              cursor: already ? "default" : "pointer", fontFamily: "inherit",
                              fontSize: 11.5, textAlign: "left",
                              background: already ? "#ffffff06" : "transparent",
                              color: already ? "#555" : "#999", opacity: already ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = "#ffffff08"; }}
                            onMouseLeave={(e) => { if (!already) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{ flex: 1 }}>{m.name}</span>
                            {m.ctx && m.ctx !== "?" && <span style={{ fontSize: 9, color: "#444" }}>{m.ctx}</span>}
                            {already && <span style={{ fontSize: 9, color: "#444" }}>added</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
