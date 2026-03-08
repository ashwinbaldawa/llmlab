import React, { useState, useRef, useEffect } from "react";

export default function Dropdown({ value, onChange, options, renderOption, placeholder, width }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div ref={ref} style={{ position: "relative", width: width || "auto" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
          background: "#15151e", border: "1px solid " + (open ? "#3a3a4a" : "#22222e"), borderRadius: 10,
          color: "#d0d0dc", cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left",
          transition: "border-color .2s",
        }}
      >
        {selected ? renderOption(selected) : <span style={{ color: "#555" }}>{placeholder}</span>}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#555", transform: open ? "rotate(180deg)" : "", transition: "transform .2s" }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "#18181f", border: "1px solid #2a2a35", borderRadius: 10,
          boxShadow: "0 12px 40px rgba(0,0,0,.5)", maxHeight: 280, overflowY: "auto",
          animation: "ddIn .15s ease-out",
        }}>
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => { onChange(o.id); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px",
                border: "none", background: value === o.id ? "#ffffff08" : "transparent",
                color: value === o.id ? "#fff" : "#aaa", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, textAlign: "left", transition: "background .15s",
                borderLeft: value === o.id ? "2px solid " + (o.accent || o.color || "#6366f1") : "2px solid transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff06")}
              onMouseLeave={(e) => (e.currentTarget.style.background = value === o.id ? "#ffffff08" : "transparent")}
            >
              {renderOption(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
