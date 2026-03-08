import React, { useState, useEffect, useCallback, useRef } from "react";
import PROVIDERS from "./data/providers";
import TASKS from "./data/tasks";
import { rdTxt, rdB64, isImg, isPdf, isTxt } from "./utils/fileHelpers";
import { renderMd } from "./utils/renderMd";
import { loadHistory, saveRun, deleteRun, clearHistory } from "./utils/history";
import Dropdown from "./components/Dropdown";
import ModelPicker from "./components/ModelPicker";
import ModelSelectorChips from "./components/ModelSelectorChips";
import CompareView from "./components/CompareView";
import FileZone from "./components/FileZone";
import OptControl from "./components/OptControl";
import HistoryPanel from "./components/HistoryPanel";

const API_BASE = "/api";

export default function App() {
  const [task, setTask] = useState(TASKS[0]);
  const [provId, setProvId] = useState("anthropic");
  const [modId, setModId] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [opts, setOpts] = useState({});
  const [mets, setMets] = useState([]);
  const [scores, setScores] = useState({});
  const [lat, setLat] = useState(null);
  const [tok, setTok] = useState(null);
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState("text");
  const [keys, setKeys] = useState({});
  const [showKey, setShowKey] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);
  const [evalOpen, setEvalOpen] = useState(false);
  const [providerModels, setProviderModels] = useState({});

  // Compare mode state
  const [appMode, setAppMode] = useState("single"); // "single" | "compare"
  const [compareModels, setCompareModels] = useState([]);
  const [compareResults, setCompareResults] = useState(null);

  // Evaluation state (compare mode LLM-as-judge)
  const [evalResults, setEvalResults] = useState(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [judgeProvId, setJudgeProvId] = useState("openai");
  const [judgeModId, setJudgeModId] = useState("gpt-4o");
  const [evalCriteria, setEvalCriteria] = useState([]);
  const [availableCriteria, setAvailableCriteria] = useState([]);

  // History state
  const [history, setHistory] = useState(() => loadHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  // System prompt & sampling params
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(null); // null = don't send, let provider use default

  // Cancel / abort support
  const abortRef = useRef(null);

  // Evaluation settings popup
  const [showEvalPopup, setShowEvalPopup] = useState(false);
  const [popupPrompt, setPopupPrompt] = useState("");
  const [promptEdited, setPromptEdited] = useState(false);

  const prov = PROVIDERS.find((p) => p.id === provId) || PROVIDERS[0];
  const models = providerModels[provId] || [];

  const fetchModelsForProvider = useCallback((pid) => {
    if (providerModels[pid]) return;
    fetch(`${API_BASE}/models/${pid}`)
      .then((r) => r.json())
      .then((data) => setProviderModels((prev) => ({ ...prev, [pid]: data.models || [] })))
      .catch(() => {});
  }, [providerModels]);

  // Fetch available evaluation criteria on mount
  useEffect(() => {
    fetch(`${API_BASE}/evaluate/criteria`)
      .then((r) => r.json())
      .then((data) => setAvailableCriteria(data.criteria || []))
      .catch(() => {});
  }, []);

  // Fetch models from backend when provider changes
  useEffect(() => {
    if (providerModels[provId]) {
      if (providerModels[provId].length > 0) setModId(providerModels[provId][0].id);
      return;
    }
    let cancelled = false;
    fetch(`${API_BASE}/models/${provId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const m = data.models || [];
        setProviderModels((prev) => ({ ...prev, [provId]: m }));
        if (m.length > 0) setModId(m[0].id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [provId]);

  useEffect(() => {
    const d = {};
    if (task.opts) task.opts.forEach((o) => { d[o.id] = o.d; });
    setOpts(d);
    setOutput("");
    setErr("");
    setMets([]);
    setScores({});
    setLat(null);
    setTok(null);
    setFiles([]);
    setMode("text");
    setCompareResults(null);
    setEvalResults(null);
  }, [task.id]);

  // Build the full prompt from current state
  const buildPrompt = useCallback(async () => {
    let fileText = "";
    if (files.length > 0 && mode !== "text") {
      for (const f of files) {
        try { fileText += "--- " + f.name + " ---\n" + (await rdTxt(f)) + "\n--- end ---\n\n"; } catch (e) {}
      }
    }
    const prompt = task.bp(input.trim() || (files.length > 0 ? "[See uploaded files above]" : ""), opts);
    let evalSfx = "";
    if (appMode === "single" && mets.length > 0) {
      evalSfx = "\n\n---\nAfter your response, self-evaluate 1-5 on:\n" + mets.map((m) => "- " + m.l + ": " + m.d).join("\n");
    }
    return (fileText ? fileText + "\n" : "") + prompt + evalSfx;
  }, [input, files, mode, task, opts, mets, appMode]);

  // Single model run
  const run = useCallback(async (promptOverride) => {
    const hasInput = input.trim() || (files.length > 0 && mode !== "text");
    if (!hasInput) return;
    const key = keys[provId] || "";

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr("");
    setOutput("");
    setLat(null);
    setTok(null);
    setEvalResults(null);

    const fullPrompt = promptOverride || await buildPrompt();
    const t0 = Date.now();

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provId,
          model: modId,
          messages: [
            ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
            { role: "user", content: fullPrompt },
          ],
          api_key: key || undefined,
          max_tokens: 2048,
          temperature,
          ...(topP !== null ? { top_p: topP } : {}),
        }),
        signal: ac.signal,
      });

      const latency = Date.now() - t0;
      setLat(latency);

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.detail || prov.name + " error " + res.status);
      }

      const data = await res.json();
      const content = data.content || "No response.";
      setOutput(content);
      if (data.usage) setTok({ i: data.usage.input_tokens, o: data.usage.output_tokens });

      // Save to history
      const curModel = models.find((m) => m.id === modId);
      setHistory(saveRun({
        type: "single",
        taskId: task.id,
        taskIcon: task.icon,
        taskLabel: task.label,
        provider: provId,
        model: modId,
        modelName: curModel?.name || modId,
        input: input.trim(),
        output: content,
        latency,
        usage: data.usage,
      }));
    } catch (e) {
      if (e.name === "AbortError") { setErr("Cancelled."); } else { setErr(e.message); }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [input, files, mode, task, opts, mets, modId, prov, provId, keys, models, buildPrompt]);

  // Compare mode run
  const runCompare = useCallback(async (promptOverride) => {
    const hasInput = input.trim() || (files.length > 0 && mode !== "text");
    if (!hasInput || compareModels.length < 2) return;

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr("");
    setCompareResults(null);
    setEvalResults(null);

    const fullPrompt = promptOverride || await buildPrompt();

    try {
      const res = await fetch(`${API_BASE}/chat/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          models: compareModels.map((cm) => ({
            provider: cm.provider,
            model: cm.model,
            api_key: keys[cm.provider] || undefined,
          })),
          messages: [
            ...(systemPrompt.trim() ? [{ role: "system", content: systemPrompt.trim() }] : []),
            { role: "user", content: fullPrompt },
          ],
          max_tokens: 2048,
          temperature,
          ...(topP !== null ? { top_p: topP } : {}),
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.detail || "Compare error " + res.status);
      }

      const data = await res.json();
      setCompareResults(data.results);

      // Save to history
      setHistory(saveRun({
        type: "compare",
        taskId: task.id,
        taskIcon: task.icon,
        taskLabel: task.label,
        modelCount: compareModels.length,
        input: input.trim(),
        output: data.results.map((r) => r.content || r.error || "").join("\n---\n"),
        latency: Math.max(...data.results.map((r) => r.latency_ms || 0)),
      }));
    } catch (e) {
      if (e.name === "AbortError") { setErr("Cancelled."); } else { setErr(e.message); }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }, [input, files, mode, task, opts, mets, compareModels, keys, buildPrompt]);

  // LLM-as-judge evaluation (both modes)
  const runEvaluation = useCallback(async () => {
    if (evalCriteria.length === 0) return;

    // Build outputs list based on mode
    let outputsList;
    if (appMode === "compare") {
      if (!compareResults || compareResults.length < 2) return;
      outputsList = compareResults
        .filter((r) => r && !r.error && r.content)
        .map((r) => ({ provider: r.provider, model: r.model, content: r.content }));
    } else {
      if (!output) return;
      outputsList = [{ provider: provId, model: modId, content: output }];
    }

    if (outputsList.length === 0) return;

    const judgeProvider = PROVIDERS.find((p) => p.id === judgeProvId);
    if (judgeProvider?.needsKey && !keys[judgeProvId]) {
      setErr("Add your " + (judgeProvider?.name || judgeProvId) + " API key to run evaluation.");
      setShowKey(true);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setEvalLoading(true);
    setEvalResults(null);

    try {
      const res = await fetch(`${API_BASE}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_text: input.trim(),
          outputs: outputsList,
          criteria: evalCriteria,
          judge_provider: judgeProvId,
          judge_model: judgeModId,
          judge_api_key: keys[judgeProvId] || undefined,
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.detail || "Evaluation error " + res.status);
      }

      const data = await res.json();

      if (appMode === "compare") {
        // Map results back to all compareModels (including errored ones)
        const fullResults = compareResults.map((cr) => {
          if (!cr || cr.error || !cr.content) {
            return { provider: cr?.provider || "", model: cr?.model || "", scores: [], average: null };
          }
          return data.results.find((r) => r.provider === cr.provider && r.model === cr.model)
            || { provider: cr.provider, model: cr.model, scores: [], average: null };
        });
        setEvalResults(fullResults);
      } else {
        // Single mode: just use the first result
        setEvalResults(data.results);
      }
    } catch (e) {
      if (e.name === "AbortError") { setErr("Cancelled."); } else { setErr(e.message); }
    } finally {
      abortRef.current = null;
      setEvalLoading(false);
    }
  }, [compareResults, evalCriteria, judgeProvId, judgeModId, keys, input, appMode, output, provId, modId]);

  const actualRun = appMode === "compare" ? runCompare : run;

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Show eval settings popup before running
  const handleRun = useCallback(async () => {
    const p = await buildPrompt();
    setPopupPrompt(p);
    setPromptEdited(false);
    setShowEvalPopup(true);
  }, [buildPrompt]);

  // Confirm from popup — actually run
  const handleConfirmRun = useCallback(() => {
    setShowEvalPopup(false);
    actualRun(promptEdited ? popupPrompt : undefined);
  }, [actualRun, promptEdited, popupPrompt]);

  const hasIn = input.trim() || (files.length > 0 && mode !== "text");
  const curModel = models.find((m) => m.id === modId);
  const canRun = appMode === "compare" ? hasIn && compareModels.length >= 2 : hasIn;

  const handleReplay = (entry) => {
    const t = TASKS.find((x) => x.id === entry.taskId);
    if (t) setTask(t);
    setInput(entry.input || "");
    if (entry.provider) setProvId(entry.provider);
    if (entry.model) setModId(entry.model);
    if (entry.type === "compare") setAppMode("compare");
    else setAppMode("single");
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Satoshi','DM Sans','Segoe UI',sans-serif", background: "#0a0a0f", color: "#e0e0e8" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Fira+Code:wght@400&display=swap" rel="stylesheet" />
      <style>{`
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#2a2a35;border-radius:4px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ddIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#15151e;color:#d0d0d8}
        input[type=range]{-webkit-appearance:none;background:#252530;border-radius:4px;height:4px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3)}
        .md-code{background:#12121c;color:#c8d0e0;padding:14px 16px;border-radius:10px;font-size:12.5px;margin:10px 0;font-family:'Fira Code',monospace;overflow-x:auto;border:1px solid #1e1e2e}
        .md-ic{background:#1a1a28;padding:2px 6px;border-radius:4px;font-size:.88em;font-family:'Fira Code',monospace;color:#a5b4fc}
      `}</style>

      {/* TOP BAR */}
      <header style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 28px", borderBottom: "1px solid #1a1a24", background: "#0c0c12" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>LL</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.02em" }}>LLMLab</div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "#1e1e28", margin: "0 4px" }} />

        <Dropdown
          value={task.id}
          onChange={(id) => setTask(TASKS.find((t) => t.id === id))}
          options={TASKS.map((t) => ({ ...t, color: t.accent }))}
          renderOption={(t) => (
            <React.Fragment>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              <span style={{ fontWeight: 500 }}>{t.label}</span>
            </React.Fragment>
          )}
          placeholder="Select task"
          width={180}
        />

        {/* Mode toggle: Single / Compare */}
        <div style={{ display: "flex", background: "#12121a", borderRadius: 8, padding: 2, border: "1px solid #1e1e28" }}>
          {[{ k: "single", l: "Single" }, { k: "compare", l: "Compare" }].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => { setAppMode(k); setCompareResults(null); setErr(""); }}
              style={{
                padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: 11.5, fontWeight: appMode === k ? 600 : 400,
                background: appMode === k ? (k === "compare" ? "#a78bfa18" : "#ffffff10") : "transparent",
                color: appMode === k ? (k === "compare" ? "#a78bfa" : "#ccc") : "#666", transition: "all .2s",
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Single mode: ModelPicker */}
        {appMode === "single" && (
          <ModelPicker
            provId={provId}
            modId={modId}
            onSelect={(pid, mid) => { setProvId(pid); setModId(mid); }}
            providers={PROVIDERS}
            providerModels={providerModels}
            fetchModels={fetchModelsForProvider}
          />
        )}

        <div style={{ flex: 1 }} />

        {/* Stats (single mode) */}
        {appMode === "single" && lat != null && <span style={{ fontSize: 11, color: "#666", background: "#15151e", padding: "4px 10px", borderRadius: 8 }}>&#9201; {lat}ms</span>}
        {appMode === "single" && tok && <span style={{ fontSize: 11, color: "#666", background: "#15151e", padding: "4px 10px", borderRadius: 8 }}>&uarr;{tok.i} &darr;{tok.o} tokens</span>}

        {/* History toggle */}
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #22222e",
            background: historyOpen ? "#6366f110" : "#15151e",
            color: historyOpen ? "#6366f1" : "#888", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
          }}
        >
          &#128203; History{history.length > 0 ? ` (${history.length})` : ""}
        </button>

        <button
          onClick={() => setShowKey(!showKey)}
          style={{
            padding: "6px 14px", borderRadius: 8, border: "1px solid #22222e", background: keys[provId] ? "#22c55e10" : "#15151e",
            color: keys[provId] ? "#22c55e" : "#888", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
          }}
        >
          {keys[provId] ? "\uD83D\uDD11 Key Set" : "\uD83D\uDD11 Add Key"}
        </button>
      </header>

      {/* API Key bar */}
      {showKey && (() => {
        const keyProviders = appMode === "compare"
          ? [...new Set(compareModels.map((cm) => cm.provider))]
              .map((pid) => PROVIDERS.find((p) => p.id === pid))
              .filter((p) => p && p.needsKey)
          : [prov];
        const providersToShow = keyProviders.length > 0 ? keyProviders : [prov];
        return (
          <div style={{ padding: "10px 28px", background: "#0e0e16", borderBottom: "1px solid #1a1a24", display: "flex", flexDirection: providersToShow.length > 1 ? "column" : "row", alignItems: providersToShow.length > 1 ? "stretch" : "center", gap: 12, animation: "fadeIn .2s" }}>
            {providersToShow.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>{p.name} API Key:</span>
                <input
                  type="password"
                  value={keys[p.id] || ""}
                  onChange={(e) => setKeys({ ...keys, [p.id]: e.target.value })}
                  placeholder={p.needsKey ? "Paste your " + p.name + " API key here..." : "No key needed for " + p.name}
                  style={{ flex: 1, maxWidth: 500, padding: "7px 12px", background: "#15151e", border: "1px solid #22222e", borderRadius: 8, color: "#d0d0d8", fontSize: 12.5, fontFamily: "'Fira Code',monospace", outline: "none" }}
                />
              </div>
            ))}
            <button onClick={() => setShowKey(false)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16, alignSelf: providersToShow.length > 1 ? "flex-end" : "center" }}>x</button>
          </div>
        );
      })()}

      {/* Compare mode: model selector bar */}
      {appMode === "compare" && (
        <div style={{ padding: "10px 28px", background: "#0e0e16", borderBottom: "1px solid #1a1a24", animation: "fadeIn .2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#888", flexShrink: 0 }}>Models to compare:</span>
            <ModelSelectorChips
              selected={compareModels}
              onChange={setCompareModels}
              providers={PROVIDERS}
              providerModels={providerModels}
              fetchModels={fetchModelsForProvider}
            />
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div style={{ display: "flex", maxWidth: 1400, margin: "0 auto", padding: "20px 28px", gap: 20, minHeight: "calc(100vh - 60px)" }}>
        {/* LEFT: Input + Output */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Input panel */}
          <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", overflow: "hidden" }}>
            <div style={{ padding: "12px 18px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{task.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{task.label}</span>
                <span style={{ fontSize: 11, color: "#555" }}>Input</span>
              </div>
              <span style={{ fontSize: 11, color: "#444" }}>
                {input.length > 0 ? input.length + " chars" : ""}
                {files.length > 0 && mode !== "text" ? " \u00b7 " + files.length + " file" + (files.length > 1 ? "s" : "") : ""}
              </span>
            </div>
            <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {task.file && <FileZone task={task} files={files} setFiles={setFiles} mode={mode} setMode={setMode} />}
              {(mode === "text" || mode === "both" || !task.file) && (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (canRun && !loading) handleRun(); } }}
                  placeholder={task.ph}
                  style={{ width: "100%", minHeight: 140, resize: "vertical", border: "1px solid #1a1a24", borderRadius: 10, background: "#0a0a10", color: "#d8d8e0", padding: "12px 14px", fontSize: 13.5, fontFamily: "'DM Sans',sans-serif", lineHeight: 1.65, outline: "none", boxSizing: "border-box" }}
                />
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={() => { setInput(""); setOutput(""); setErr(""); setFiles([]); setScores({}); setLat(null); setTok(null); setCompareResults(null); setEvalResults(null); }}
                  style={{ padding: "6px 16px", border: "1px solid #1e1e28", borderRadius: 8, background: "transparent", color: "#666", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}
                >
                  Clear All
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 10.5, color: "#444" }}>Ctrl+Enter</span>
                  {(loading || evalLoading) ? (
                    <button
                      onClick={handleCancel}
                      style={{
                        padding: "8px 28px", border: "none", borderRadius: 9,
                        background: "linear-gradient(135deg,#ef4444,#dc2626)",
                        color: "#fff", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .2s",
                        boxShadow: "0 2px 12px #ef444433",
                      }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={handleRun}
                      disabled={!canRun}
                      style={{
                        padding: "8px 28px", border: "none", borderRadius: 9,
                        background: !canRun ? "#1e1e28" : appMode === "compare" ? "linear-gradient(135deg,#a78bfa,#6366f1)" : "linear-gradient(135deg," + task.accent + "," + task.accent + "cc)",
                        color: !canRun ? "#555" : "#fff", cursor: !canRun ? "not-allowed" : "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit", transition: "all .2s",
                        boxShadow: !canRun ? "none" : appMode === "compare" ? "0 2px 12px #6366f133" : "0 2px 12px " + task.accent + "33",
                      }}
                    >
                      {appMode === "compare" ? `Compare (${compareModels.length})` : "Run \u2192"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Output panel — different for single vs compare */}
          {appMode === "compare" ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 200 }}>
              {!loading && !compareResults && !err && (
                <div style={{ flex: 1, background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>&#9878;</div>
                    <div style={{ fontSize: 13, color: "#555" }}>Select 2+ models above, then hit Compare</div>
                  </div>
                </div>
              )}
              {loading && (
                <div style={{ flex: 1, background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#888", animation: "fadeIn .3s" }}>
                    <div style={{ width: 18, height: 18, border: "2px solid #a78bfa33", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    <span style={{ fontSize: 13 }}>Running {compareModels.length} models in parallel...</span>
                  </div>
                </div>
              )}
              {err && !compareResults && (
                <div style={{ padding: "12px 16px", background: "#1a1015", border: "1px solid #3a1825", borderRadius: 10, color: "#f87171", fontSize: 13, animation: "fadeIn .3s", lineHeight: 1.5 }}>
                  <strong>Error: </strong>{err}
                </div>
              )}
              {compareResults && (
                <CompareView
                  results={compareResults}
                  compareModels={compareModels}
                  providers={PROVIDERS}
                  providerModels={providerModels}
                  onRemoveModel={(i) => {
                    setCompareModels((p) => p.filter((_, j) => j !== i));
                    setCompareResults((p) => p ? p.filter((_, j) => j !== i) : null);
                    setEvalResults((p) => p ? p.filter((_, j) => j !== i) : null);
                  }}
                  input={input}
                  evalResults={evalResults}
                  evalLoading={evalLoading}
                />
              )}
            </div>
          ) : (
            <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
              <div style={{ padding: "12px 18px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>Output</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {curModel && (
                    <span style={{ fontSize: 10.5, padding: "3px 10px", borderRadius: 8, background: prov.color + "10", color: prov.color, border: "1px solid " + prov.color + "25" }}>
                      {curModel.name}
                    </span>
                  )}
                  {output && (
                    <button
                      onClick={() => navigator.clipboard && navigator.clipboard.writeText(output)}
                      style={{ fontSize: 11, color: "#555", background: "none", border: "1px solid #22222e", padding: "3px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, padding: "0 18px 16px", overflowY: "auto" }}>
                {!loading && !output && !err && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", opacity: 0.4 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>{task.icon}</div>
                    <div style={{ fontSize: 13, color: "#555" }}>Output will appear here</div>
                  </div>
                )}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 0", color: "#888", animation: "fadeIn .3s" }}>
                    <div style={{ width: 18, height: 18, border: "2px solid " + task.accent + "33", borderTopColor: task.accent, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    <span style={{ fontSize: 13 }}>Processing via {prov.name}...</span>
                  </div>
                )}
                {err && (
                  <div style={{ padding: "12px 16px", background: "#1a1015", border: "1px solid #3a1825", borderRadius: 10, color: "#f87171", fontSize: 13, animation: "fadeIn .3s", lineHeight: 1.5 }}>
                    <strong>Error: </strong>{err}
                  </div>
                )}
                {output && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.75, color: "#c4c4d0", animation: "fadeIn .4s" }} dangerouslySetInnerHTML={{ __html: renderMd(output) }} />
                )}
                {/* Single mode: LLM Judge results */}
                {evalLoading && appMode === "single" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", color: "#888", animation: "fadeIn .3s" }}>
                    <div style={{ width: 14, height: 14, border: "2px solid #a78bfa33", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    <span style={{ fontSize: 12 }}>Evaluating with LLM judge...</span>
                  </div>
                )}
                {evalResults && appMode === "single" && evalResults.length > 0 && evalResults[0]?.scores?.length > 0 && (
                  <div style={{ marginTop: 12, padding: "12px 14px", background: "#12121a", borderRadius: 10, border: "1px solid #1e1e28", animation: "fadeIn .3s" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 8 }}>LLM Judge Scores</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {evalResults[0].scores.map((s) => {
                        const color = s.score >= 4 ? "#22c55e" : s.score >= 3 ? "#eab308" : "#ef4444";
                        return (
                          <div key={s.criterion} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 32 }}>{s.score}/5</span>
                            <div>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#bbb" }}>{s.criterion_name}</span>
                              {s.reasoning && <div style={{ fontSize: 10.5, color: "#666", lineHeight: 1.4, marginTop: 2 }}>{s.reasoning}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {evalResults[0].average != null && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e1e28", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>Average</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", fontFamily: "'Fira Code',monospace" }}>
                          {evalResults[0].average.toFixed(1)}<span style={{ fontSize: 11, color: "#555" }}>/5</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Config + Eval + Prompt Preview + History */}
        <div style={{ width: 310, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Configuration */}
          <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24" }}>
            <button
              onClick={() => setConfigOpen(!configOpen)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>Configuration</span>
              <span style={{ fontSize: 11, color: "#555", transform: configOpen ? "rotate(180deg)" : "", transition: "transform .2s" }}>{"\u25BE"}</span>
            </button>
            {configOpen && (
              <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn .2s" }}>
                {task.opts && task.opts.map((o) => (
                  <div key={o.id}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: o.t === "tog" ? "space-between" : "flex-start", marginBottom: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#999" }}>{o.l}</label>
                      {o.t === "tog" && <OptControl opt={o} value={opts[o.id]} onChange={(v) => setOpts((p) => ({ ...p, [o.id]: v }))} accent={task.accent} />}
                    </div>
                    {o.t !== "tog" && <OptControl opt={o} value={opts[o.id]} onChange={(v) => setOpts((p) => ({ ...p, [o.id]: v }))} accent={task.accent} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluation */}
          <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24" }}>
            <button
              onClick={() => setEvalOpen(!evalOpen)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 18px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>Evaluation{mets.length > 0 ? " (" + mets.length + ")" : ""}</span>
              <span style={{ fontSize: 11, color: "#555", transform: evalOpen ? "rotate(180deg)" : "", transition: "transform .2s" }}>{"\u25BE"}</span>
            </button>
            {evalOpen && (
              <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10, animation: "fadeIn .2s" }}>
                {/* Task-specific metrics (self-eval) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {(task.metrics || []).map((m) => {
                    const on = mets.some((x) => x.id === m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMets((p) => on ? p.filter((x) => x.id !== m.id) : [...p, m])}
                        style={{
                          padding: "4px 12px", borderRadius: 20, fontSize: 11.5, fontWeight: on ? 600 : 400,
                          border: "1.5px solid " + (on ? task.accent : "#2a2a35"), cursor: "pointer", fontFamily: "inherit",
                          background: on ? task.accent + "15" : "transparent", color: on ? task.accent : "#888",
                        }}
                      >
                        {m.l}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10.5, color: "#444", lineHeight: 1.4 }}>Selected metrics are included for AI self-evaluation.</div>

                {/* Single mode: manual scoring */}
                {appMode === "single" && mets.length > 0 && output && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#888" }}>Manual Scoring</div>
                    {mets.map((m) => (
                      <div key={m.id} style={{ padding: "8px 10px", background: "#12121a", borderRadius: 9, border: "1px solid #1e1e28", display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#bbb" }}>{m.l}</div>
                          <div style={{ fontSize: 10, color: "#555" }}>{m.d}</div>
                        </div>
                        <div style={{ display: "flex", gap: 3 }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => setScores((p) => ({ ...p, [m.id]: n }))}
                              style={{
                                width: 24, height: 24, borderRadius: 6,
                                border: "1.5px solid " + ((scores[m.id] || 0) >= n ? task.accent : "#2a2a35"),
                                background: (scores[m.id] || 0) >= n ? task.accent + "20" : "transparent",
                                color: (scores[m.id] || 0) >= n ? task.accent : "#555",
                                fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                              }}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {Object.keys(scores).length > 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: 10, background: task.accent + "08", border: "1px solid " + task.accent + "20", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#aaa" }}>Average</span>
                        <span style={{ fontSize: 20, fontWeight: 700, color: task.accent, fontFamily: "'Fira Code',monospace" }}>
                          {(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length).toFixed(1)}
                          <span style={{ fontSize: 12, color: "#555" }}>/5</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* LLM-as-Judge (both modes) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, paddingTop: 8, borderTop: "1px solid #1e1e28" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "#a78bfa" }}>LLM-as-Judge</div>

                  {/* Criteria selection */}
                  <div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Evaluation Criteria:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {availableCriteria.map((c) => {
                        const on = evalCriteria.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => setEvalCriteria((p) => on ? p.filter((x) => x !== c.id) : [...p, c.id])}
                            title={c.description}
                            style={{
                              padding: "3px 10px", borderRadius: 16, fontSize: 10.5, fontWeight: on ? 600 : 400,
                              border: "1.5px solid " + (on ? "#a78bfa" : "#2a2a35"), cursor: "pointer", fontFamily: "inherit",
                              background: on ? "#a78bfa15" : "transparent", color: on ? "#a78bfa" : "#888",
                            }}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                    {evalCriteria.length === 0 && (
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>Select at least one criterion to evaluate.</div>
                    )}
                  </div>

                  {/* Judge model selector */}
                  <div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Judge Model:</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={judgeProvId}
                        onChange={(e) => {
                          setJudgeProvId(e.target.value);
                          fetchModelsForProvider(e.target.value);
                        }}
                        style={{ flex: 1, padding: "5px 8px", background: "#15151e", border: "1px solid #22222e", borderRadius: 6, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        value={judgeModId}
                        onChange={(e) => setJudgeModId(e.target.value)}
                        style={{ flex: 1.5, padding: "5px 8px", background: "#15151e", border: "1px solid #22222e", borderRadius: 6, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                      >
                        {(providerModels[judgeProvId] || []).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                        {!(providerModels[judgeProvId] || []).length && (
                          <option value={judgeModId}>{judgeModId}</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Evaluate button */}
                  {(() => {
                    const hasOutput = appMode === "compare" ? !!compareResults : !!output;
                    const disabled = evalLoading || !hasOutput || evalCriteria.length === 0;
                    return (
                      <button
                        onClick={runEvaluation}
                        disabled={disabled}
                        style={{
                          padding: "7px 16px", border: "none", borderRadius: 8,
                          background: disabled ? "#1e1e28" : "linear-gradient(135deg,#a78bfa,#6366f1)",
                          color: disabled ? "#555" : "#fff",
                          cursor: disabled ? "not-allowed" : "pointer",
                          fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                          boxShadow: disabled ? "none" : "0 2px 12px #6366f133",
                        }}
                      >
                        {evalLoading ? "Evaluating..." : `Evaluate (${evalCriteria.length} criteria)`}
                      </button>
                    );
                  })()}

                  <div style={{ fontSize: 10, color: "#444", lineHeight: 1.3 }}>
                    Uses a separate LLM to score {appMode === "compare" ? "each output" : "the output"} on selected criteria (1-5 scale with reasoning).
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prompt Preview */}
          <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", padding: "12px 18px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "#555", marginBottom: 6 }}>Prompt Preview</div>
            <div style={{ fontSize: 11, lineHeight: 1.5, color: "#444", fontFamily: "'Fira Code',monospace", maxHeight: 120, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {task.bp(input || "[your input here]", opts)}
            </div>
          </div>

          {/* History Panel */}
          {historyOpen && (
            <div style={{ background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24", overflow: "hidden", animation: "fadeIn .2s" }}>
              <div style={{ padding: "12px 18px 8px" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>Run History</span>
              </div>
              <div style={{ padding: "0 10px 12px", maxHeight: 400, overflowY: "auto" }}>
                <HistoryPanel
                  history={history}
                  onReplay={handleReplay}
                  onDelete={(id) => setHistory(deleteRun(id))}
                  onClear={() => setHistory(clearHistory())}
                  providers={PROVIDERS}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Run Settings Popup */}
      {showEvalPopup && (() => {
        // Compute which providers need API keys
        const neededKeyProviders = (() => {
          const pids = new Set();
          if (appMode === "compare") {
            compareModels.forEach((cm) => pids.add(cm.provider));
          } else {
            pids.add(provId);
          }
          return [...pids]
            .map((pid) => PROVIDERS.find((p) => p.id === pid))
            .filter((p) => p && p.needsKey);
        })();
        const missingKeys = neededKeyProviders.filter((p) => !keys[p.id]);

        return (
          <div
            data-testid="eval-popup-overlay"
            onClick={() => setShowEvalPopup(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 100,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "fadeIn .15s",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#12121c", borderRadius: 16, border: "1px solid #2a2a35",
                width: 520, maxHeight: "85vh", overflowY: "auto",
                boxShadow: "0 16px 48px rgba(0,0,0,.5)", animation: "fadeIn .2s",
              }}
            >
              <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #1e1e28", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e8" }}>Run Settings</span>
                <button
                  onClick={() => setShowEvalPopup(false)}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 18, padding: "0 4px" }}
                >
                  x
                </button>
              </div>

              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
                {/* API Keys section */}
                {neededKeyProviders.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 6 }}>API Keys</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {neededKeyProviders.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: p.color, fontWeight: 500, minWidth: 80, flexShrink: 0 }}>{p.name}</span>
                          <input
                            type="password"
                            value={keys[p.id] || ""}
                            onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder={"Paste " + p.name + " API key..."}
                            style={{
                              flex: 1, padding: "6px 10px", background: "#0e0e16",
                              border: "1px solid " + (keys[p.id] ? "#22c55e30" : "#3a182540"),
                              borderRadius: 7, color: "#d0d0d8", fontSize: 11,
                              fontFamily: "'Fira Code',monospace", outline: "none",
                            }}
                          />
                          {keys[p.id] ? (
                            <span style={{ fontSize: 10, color: "#22c55e", flexShrink: 0 }}>Set</span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#ef4444", flexShrink: 0 }}>Required</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {missingKeys.length > 0 && (
                      <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>
                        {missingKeys.length === 1
                          ? missingKeys[0].name + " API key is required to run."
                          : missingKeys.length + " API keys are required to run."}
                      </div>
                    )}
                  </div>
                )}

                {/* System Prompt */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 6 }}>System Prompt</div>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="e.g. You are a senior legal analyst who writes concise, precise summaries..."
                    style={{
                      width: "100%", minHeight: 60, maxHeight: 140, padding: "8px 12px",
                      background: "#0e0e16", border: "1px solid " + (systemPrompt.trim() ? "#a78bfa30" : "#1e1e28"),
                      borderRadius: 10, color: "#ccc", fontSize: 11, lineHeight: 1.5,
                      fontFamily: "'Fira Code',monospace", outline: "none", resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                    {systemPrompt.trim() ? "System message will be sent before the user prompt." : "Optional — sets the persona or instructions for the model."}
                  </div>
                </div>

                {/* Temperature & Top-P */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 8 }}>Sampling Parameters</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#888" }}>Temperature</span>
                        <span style={{ fontSize: 11, color: "#ccc", fontWeight: 600, fontFamily: "'Fira Code',monospace" }}>{temperature.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0" max="2" step="0.05" value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        style={{ width: "100%", accentColor: "#a78bfa" }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#555" }}>
                        <span>Deterministic</span><span>Balanced</span><span>Creative</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <label style={{ fontSize: 11, color: "#888", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={topP !== null}
                            onChange={(e) => setTopP(e.target.checked ? 1.0 : null)}
                            style={{ accentColor: "#6366f1" }}
                          />
                          Top-P
                        </label>
                        {topP !== null && (
                          <span style={{ fontSize: 11, color: "#ccc", fontWeight: 600, fontFamily: "'Fira Code',monospace" }}>{topP.toFixed(2)}</span>
                        )}
                      </div>
                      {topP !== null && (
                        <>
                          <input
                            type="range" min="0" max="1" step="0.05" value={topP}
                            onChange={(e) => setTopP(parseFloat(e.target.value))}
                            style={{ width: "100%", accentColor: "#6366f1" }}
                          />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#555" }}>
                            <span>Focused</span><span>Balanced</span><span>Diverse</span>
                          </div>
                        </>
                      )}
                      {topP === null && (
                        <div style={{ fontSize: 10, color: "#555" }}>Disabled — provider will use its default. Anthropic does not allow both Temperature and Top-P.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Self-eval metrics */}
                {appMode === "single" && (task.metrics || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 6 }}>Self-Evaluation Metrics</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {(task.metrics || []).map((m) => {
                        const on = mets.some((x) => x.id === m.id);
                        return (
                          <button
                            key={m.id}
                            onClick={() => setMets((p) => on ? p.filter((x) => x.id !== m.id) : [...p, m])}
                            style={{
                              padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: on ? 600 : 400,
                              border: "1.5px solid " + (on ? task.accent : "#2a2a35"), cursor: "pointer", fontFamily: "inherit",
                              background: on ? task.accent + "15" : "transparent", color: on ? task.accent : "#888",
                            }}
                          >
                            {m.l}
                          </button>
                        );
                      })}
                    </div>
                    {mets.length === 0 && (
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>None selected - model will not self-evaluate.</div>
                    )}
                    {mets.length > 0 && (
                      <div style={{ fontSize: 10, color: task.accent, marginTop: 4 }}>{mets.length} metric{mets.length > 1 ? "s" : ""} will be appended to the prompt.</div>
                    )}
                  </div>
                )}

                {/* LLM Judge settings */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#a78bfa", marginBottom: 6 }}>LLM-as-Judge</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
                    After generation, you can evaluate using a separate judge model.
                  </div>
                  <div style={{ padding: "10px 12px", background: "#0e0e16", borderRadius: 10, border: "1px solid #1e1e28" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: "#666", width: 50, flexShrink: 0 }}>Judge:</span>
                      <select
                        value={judgeProvId}
                        onChange={(e) => {
                          setJudgeProvId(e.target.value);
                          fetchModelsForProvider(e.target.value);
                        }}
                        style={{ flex: 1, padding: "5px 8px", background: "#15151e", border: "1px solid #22222e", borderRadius: 6, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                      >
                        {PROVIDERS.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <select
                        value={judgeModId}
                        onChange={(e) => setJudgeModId(e.target.value)}
                        style={{ flex: 1.5, padding: "5px 8px", background: "#15151e", border: "1px solid #22222e", borderRadius: 6, color: "#ccc", fontSize: 11, fontFamily: "inherit", outline: "none" }}
                      >
                        {(providerModels[judgeProvId] || []).map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                        {!(providerModels[judgeProvId] || []).length && (
                          <option value={judgeModId}>{judgeModId}</option>
                        )}
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Criteria ({evalCriteria.length}):</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {availableCriteria.map((c) => {
                        const on = evalCriteria.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            onClick={() => setEvalCriteria((p) => on ? p.filter((x) => x !== c.id) : [...p, c.id])}
                            title={c.description}
                            style={{
                              padding: "3px 9px", borderRadius: 14, fontSize: 10, fontWeight: on ? 600 : 400,
                              border: "1.5px solid " + (on ? "#a78bfa" : "#2a2a35"), cursor: "pointer", fontFamily: "inherit",
                              background: on ? "#a78bfa15" : "transparent", color: on ? "#a78bfa" : "#666",
                            }}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    </div>
                    {evalCriteria.length === 0 && (
                      <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>No criteria selected — judge evaluation will be skipped.</div>
                    )}
                    {evalCriteria.length > 0 && (() => {
                      const jp = PROVIDERS.find((p) => p.id === judgeProvId);
                      if (!jp || !jp.needsKey) return null;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: jp.color, fontWeight: 500, minWidth: 80, flexShrink: 0 }}>{jp.name} Key</span>
                          <input
                            type="password"
                            value={keys[jp.id] || ""}
                            onChange={(e) => setKeys((prev) => ({ ...prev, [jp.id]: e.target.value }))}
                            placeholder={"Paste " + jp.name + " API key for judge..."}
                            style={{
                              flex: 1, padding: "6px 10px", background: "#15151e",
                              border: "1px solid " + (keys[jp.id] ? "#22c55e30" : "#3a182540"),
                              borderRadius: 7, color: "#d0d0d8", fontSize: 11,
                              fontFamily: "'Fira Code',monospace", outline: "none",
                            }}
                          />
                          {keys[jp.id] ? (
                            <span style={{ fontSize: 10, color: "#22c55e", flexShrink: 0 }}>Set</span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#f59e0b", flexShrink: 0 }}>Needed</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Prompt Preview / Edit */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#999", marginBottom: 6 }}>Prompt Preview</div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>This is the full prompt that will be sent to the LLM. You can edit it before running.</div>
                  <textarea
                    value={popupPrompt}
                    onChange={(e) => { setPopupPrompt(e.target.value); setPromptEdited(true); }}
                    style={{
                      width: "100%", minHeight: 100, maxHeight: 200, padding: "10px 12px",
                      background: "#0e0e16", border: "1px solid " + (promptEdited ? "#a78bfa40" : "#1e1e28"),
                      borderRadius: 10, color: "#ccc", fontSize: 11, lineHeight: 1.5,
                      fontFamily: "'Fira Code',monospace", outline: "none", resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                  {promptEdited && (
                    <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>Prompt modified — your edits will be used for this run.</div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: "12px 20px 16px", borderTop: "1px solid #1e1e28", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  onClick={() => setShowEvalPopup(false)}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "1px solid #2a2a35",
                    background: "transparent", color: "#888", cursor: "pointer",
                    fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRun}
                  disabled={missingKeys.length > 0}
                  style={{
                    padding: "8px 24px", border: "none", borderRadius: 8,
                    background: missingKeys.length > 0 ? "#1e1e28"
                      : appMode === "compare" ? "linear-gradient(135deg,#a78bfa,#6366f1)" : "linear-gradient(135deg," + task.accent + "," + task.accent + "cc)",
                    color: missingKeys.length > 0 ? "#555" : "#fff",
                    cursor: missingKeys.length > 0 ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                    boxShadow: missingKeys.length > 0 ? "none"
                      : appMode === "compare" ? "0 2px 12px #6366f133" : "0 2px 12px " + task.accent + "33",
                  }}
                >
                  {appMode === "compare" ? `Compare (${compareModels.length})` : "Run"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
