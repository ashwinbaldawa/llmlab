import React from "react";

export default function OptControl({ opt, value, onChange, accent }) {
  if (opt.t === "sel") {
    return (
      <select
        value={value || opt.d}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "7px 10px", background: "#15151e", border: "1px solid #22222e",
          borderRadius: 8, color: "#d0d0d8", fontSize: 12.5, fontFamily: "inherit", outline: "none", cursor: "pointer",
        }}
      >
        {opt.ch.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }

  if (opt.t === "multi") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {opt.ch.map((c) => {
          const arr = Array.isArray(value) ? value : [];
          const on = arr.includes(c);
          return (
            <button
              key={c}
              onClick={() => onChange(on ? arr.filter((x) => x !== c) : [...arr, c])}
              style={{
                padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: on ? 600 : 400,
                border: "1.5px solid " + (on ? accent : "#2a2a35"), cursor: "pointer", fontFamily: "inherit",
                background: on ? accent + "15" : "transparent", color: on ? accent : "#888", transition: "all .2s",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>
    );
  }

  if (opt.t === "tog") {
    const on = !!value;
    return (
      <button
        onClick={() => onChange(!on)}
        style={{
          width: 38, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
          position: "relative", background: on ? accent : "#2a2a35", transition: "all .25s", padding: 0,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 7, background: "#fff", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left .25s" }} />
      </button>
    );
  }

  if (opt.t === "sli") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="range"
          min={opt.min}
          max={opt.max}
          value={value ?? opt.d}
          onChange={(e) => onChange(+e.target.value)}
          style={{ flex: 1, accentColor: accent }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, color: accent, minWidth: 20 }}>{value ?? opt.d}</span>
      </div>
    );
  }

  if (opt.t === "txt") {
    return (
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opt.placeholder || ""}
        style={{
          width: "100%", padding: "7px 10px", background: "#15151e", border: "1px solid #22222e",
          borderRadius: 8, color: "#d0d0d8", fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
        }}
      />
    );
  }

  return null;
}
