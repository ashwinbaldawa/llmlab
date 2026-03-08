import React, { useRef } from "react";
import { isImg, isPdf, fmtSz } from "../utils/fileHelpers";

export default function FileZone({ task, files, setFiles, mode, setMode }) {
  const ref = useRef(null);
  const fc = task.file;
  if (!fc) return null;

  const add = (nf) => {
    const valid = Array.from(nf).filter((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      return fc.acc.split(",").some((a) => a.trim() === ext) && f.size <= fc.mb * 1048576;
    });
    setFiles([...files, ...valid].slice(0, fc.mx));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", background: "#12121a", borderRadius: 8, padding: 2, border: "1px solid #1e1e28", width: "fit-content" }}>
        {[{ k: "text", l: "Text Input" }, { k: "file", l: "File Upload" }, { k: "both", l: "Both" }].map(({ k, l }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 11.5, fontWeight: mode === k ? 600 : 400,
              background: mode === k ? task.accent + "18" : "transparent",
              color: mode === k ? task.accent : "#666", transition: "all .2s",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {(mode === "file" || mode === "both") && (
        <div
          onClick={() => ref.current && ref.current.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); add(e.dataTransfer.files); }}
          style={{
            border: "2px dashed #252530", borderRadius: 12, padding: files.length ? 10 : "20px 16px",
            cursor: "pointer", background: "#0e0e16", transition: "border-color .2s", textAlign: "center",
          }}
        >
          <input
            ref={ref}
            type="file"
            multiple
            accept={fc.acc}
            style={{ display: "none" }}
            onChange={(e) => { add(e.target.files); e.target.value = ""; }}
          />
          {files.length === 0 ? (
            <div>
              <div style={{ fontSize: 13, color: "#777", marginBottom: 4 }}>
                Drop files or <span style={{ color: task.accent, fontWeight: 600 }}>browse</span>
              </div>
              <div style={{ fontSize: 11, color: "#444" }}>
                {fc.hint} — max {fc.mx} files, {fc.mb}MB each
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "#16161f", borderRadius: 8, border: "1px solid #22222e" }}>
                  <span style={{ fontSize: 14 }}>{isImg(f) ? "🖼️" : isPdf(f) ? "📕" : "📄"}</span>
                  <span style={{ flex: 1, fontSize: 12, color: "#bbb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <span style={{ fontSize: 10, color: "#555" }}>{fmtSz(f.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles(files.filter((_, j) => j !== i)); }}
                    style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 13, padding: "0 4px" }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {files.length < fc.mx && (
                <div style={{ fontSize: 10.5, color: "#555", textAlign: "center", paddingTop: 2 }}>
                  + Add more ({files.length}/{fc.mx})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
