import { useState, useRef, useEffect } from "react";

const Dot = ({ color, size = 8 }) => (
  <span
    style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}66`,
      flexShrink: 0,
    }}
  />
);

export default function ModelPicker({ provId, modId, onSelect, providers, providerModels, fetchModels }) {
  const [open, setOpen] = useState(false);
  const [activeProv, setActiveProv] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setActiveProv(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const curProv = providers.find((p) => p.id === provId) || providers[0];
  const curModels = providerModels[provId] || [];
  const curModel = curModels.find((m) => m.id === modId);

  const handleProvClick = (pid) => {
    if (activeProv === pid) {
      setActiveProv(null);
    } else {
      setActiveProv(pid);
      fetchModels(pid);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); if (!open) { setActiveProv(null); } }}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "7px 14px",
          background: "#15151e", border: "1px solid " + (open ? curProv.color + "44" : "#22222e"), borderRadius: 10,
          color: "#d0d0dc", cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left",
          transition: "all .2s", minWidth: 280,
        }}
      >
        <Dot color={curProv.color} />
        <span style={{ color: curProv.color, fontWeight: 600, fontSize: 12.5 }}>{curProv.name}</span>
        <span style={{ color: "#333", fontSize: 11 }}>/</span>
        <span style={{ fontWeight: 500, flex: 1, fontSize: 12.5, color: "#c0c0cc" }}>{curModel ? curModel.name : (modId || "Select model")}</span>
        {curModel && curModel.category && (
          <span style={{
            fontSize: 9, padding: "2px 8px", borderRadius: 6,
            background: curProv.color + "12", color: curProv.color + "bb",
            fontWeight: 600, letterSpacing: ".02em",
          }}>
            {curModel.category}
          </span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4, transform: open ? "rotate(180deg)" : "", transition: "transform .2s" }}>
          <path d="M1 3.5L5 7L9 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
          display: "flex", animation: "ddIn .15s ease-out",
        }}>
          {/* Provider list */}
          <div style={{
            background: "#141419", border: "1px solid #222230",
            borderRadius: activeProv ? "14px 0 0 14px" : "14px",
            boxShadow: activeProv ? "none" : "0 20px 60px rgba(0,0,0,.7)",
            width: 220, overflow: "hidden",
          }}>
            <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #1c1c28" }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: "#555" }}>
                Provider
              </div>
            </div>
            <div style={{ padding: "6px" }}>
              {providers.map((p) => {
                const isActive = provId === p.id;
                const isSelected = activeProv === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() => handleProvClick(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "9px 12px", border: "none", borderRadius: 9, cursor: "pointer",
                      fontFamily: "inherit", fontSize: 13, textAlign: "left",
                      transition: "background .12s",
                      background: isSelected ? p.color + "15" : isActive ? "#ffffff06" : "transparent",
                      borderLeft: isSelected ? `2px solid ${p.color}` : isActive ? `2px solid ${p.color}44` : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#1e1e2a"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isActive ? "#ffffff06" : "transparent"; }}
                  >
                    <Dot color={p.color} size={9} />
                    <span style={{
                      flex: 1, fontSize: 13,
                      fontWeight: isSelected || isActive ? 600 : 500,
                      color: isSelected ? p.color : isActive ? p.color + "cc" : "#b0b0bc",
                    }}>
                      {p.name}
                    </span>
                    <svg width="8" height="8" viewBox="0 0 8 8" style={{
                      opacity: isSelected ? 0.6 : 0.25,
                      color: isSelected ? p.color : "currentColor",
                      transition: "all .15s",
                    }}>
                      <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model flyout (connected, no gap) */}
          {activeProv && (() => {
            const p = providers.find((x) => x.id === activeProv);
            if (!p) return null;
            const pModels = providerModels[activeProv] || [];

            return (
              <div style={{
                background: "#141419", borderTop: "1px solid #222230", borderRight: "1px solid #222230", borderBottom: "1px solid #222230",
                borderRadius: "0 14px 14px 0",
                boxShadow: "0 20px 60px rgba(0,0,0,.7)",
                width: 280, overflow: "hidden",
                animation: "ddIn .1s ease-out",
              }}>
                <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #1c1c28" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: p.color, textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {p.name} Models
                  </div>
                </div>
                <div style={{ padding: "4px 6px 6px", maxHeight: 380, overflowY: "auto" }}>
                  {pModels.length === 0 && (
                    <div style={{ padding: "12px", fontSize: 11, color: "#555" }}>Loading models...</div>
                  )}
                  {(() => {
                    let lastCat = null;
                    return pModels.map((m) => {
                      const isCur = provId === p.id && modId === m.id;
                      const showHeader = m.category !== lastCat;
                      lastCat = m.category;
                      return (
                        <div key={m.id}>
                          {showHeader && (
                            <div style={{
                              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
                              color: "#555", padding: "8px 10px 4px", marginTop: 4,
                            }}>
                              {m.category}
                            </div>
                          )}
                          <button
                            onClick={() => { onSelect(p.id, m.id); setOpen(false); setActiveProv(null); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 8, width: "100%",
                              padding: "7px 10px", border: "none", borderRadius: 8,
                              cursor: "pointer", fontFamily: "inherit", fontSize: 12,
                              textAlign: "left", transition: "all .12s",
                              background: isCur ? p.color + "14" : "transparent",
                              color: isCur ? "#fff" : "#999",
                              borderLeft: isCur ? `2px solid ${p.color}` : "2px solid transparent",
                            }}
                            onMouseEnter={(e) => { if (!isCur) { e.currentTarget.style.background = "#ffffff08"; e.currentTarget.style.color = "#ccc"; } }}
                            onMouseLeave={(e) => { if (!isCur) { e.currentTarget.style.background = isCur ? p.color + "14" : "transparent"; e.currentTarget.style.color = isCur ? "#fff" : "#999"; } }}
                          >
                            <span style={{ flex: 1, fontWeight: isCur ? 600 : 400 }}>{m.name}</span>
                            {m.ctx && m.ctx !== "?" && (
                              <span style={{ fontSize: 9, color: "#444" }}>{m.ctx}</span>
                            )}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
