import React, { useState } from "react";
import { renderMd } from "../utils/renderMd";
import { computeMetrics, formatMetric, METRIC_LABELS } from "../utils/evalMetrics";

const Dot = ({ color, size = 7 }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}55`, flexShrink: 0 }} />
);

function MetricsPill({ label, value, best, accent }) {
  return (
    <span style={{
      fontSize: 10, padding: "2px 7px", borderRadius: 6,
      background: best ? accent + "18" : "#15151e",
      color: best ? accent : "#666",
      border: "1px solid " + (best ? accent + "30" : "#1e1e28"),
      fontWeight: best ? 600 : 400,
      whiteSpace: "nowrap",
    }}>
      {label}: {value}
    </span>
  );
}

function JudgeScoreBadge({ score, label, reasoning }) {
  const [showTip, setShowTip] = useState(false);
  const color = score >= 4 ? "#22c55e" : score >= 3 ? "#eab308" : "#ef4444";
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span style={{
        fontSize: 10, padding: "2px 7px", borderRadius: 6,
        background: color + "15", color, border: "1px solid " + color + "30",
        fontWeight: 600, cursor: "default", whiteSpace: "nowrap",
      }}>
        {label}: {score}/5
      </span>
      {showTip && reasoning && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          background: "#1a1a24", border: "1px solid #2a2a35", borderRadius: 8, padding: "8px 10px",
          fontSize: 11, color: "#bbb", lineHeight: 1.4, width: 220, zIndex: 50,
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
        }}>
          {reasoning}
        </div>
      )}
    </span>
  );
}

function ResultCard({ result, provider, accent, onRemove, deterministicMetrics, judgeScores, bestMetrics, input }) {
  const hasError = !!result?.error;
  const loading = !result;
  const [showMetrics, setShowMetrics] = useState(true);

  return (
    <div style={{
      flex: 1, minWidth: 0, background: "#0e0e16", borderRadius: 14,
      border: "1px solid " + (hasError ? "#3a1825" : "#1a1a24"),
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 14px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #1a1a24" }}>
        <Dot color={accent} />
        <span style={{ fontSize: 12, fontWeight: 600, color: accent }}>{provider?.name || result?.provider}</span>
        <span style={{ fontSize: 11, color: "#555" }}>/</span>
        <span style={{ fontSize: 11.5, color: "#bbb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {result?.model || "..."}
        </span>
        {onRemove && (
          <button onClick={onRemove} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>x</button>
        )}
      </div>

      {/* Stats bar */}
      {result && !hasError && (
        <div style={{ padding: "6px 14px", display: "flex", gap: 12, borderBottom: "1px solid #1a1a24" }}>
          {result.latency_ms != null && (
            <span style={{ fontSize: 10.5, color: "#666" }}>&#9201; {result.latency_ms}ms</span>
          )}
          {result.usage && (
            <span style={{ fontSize: 10.5, color: "#666" }}>&uarr;{result.usage.input_tokens} &darr;{result.usage.output_tokens}</span>
          )}
        </div>
      )}

      {/* Deterministic Metrics */}
      {result && !hasError && deterministicMetrics && showMetrics && (
        <div style={{ padding: "6px 14px", display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid #1a1a24" }}>
          {Object.entries(deterministicMetrics).map(([key, value]) => {
            if (value === null || value === undefined) return null;
            return (
              <MetricsPill
                key={key}
                label={METRIC_LABELS[key] || key}
                value={formatMetric(key, value)}
                best={bestMetrics?.[key]}
                accent={accent}
              />
            );
          })}
        </div>
      )}

      {/* LLM Judge Scores */}
      {judgeScores && judgeScores.length > 0 && (
        <div style={{ padding: "6px 14px", display: "flex", flexWrap: "wrap", gap: 4, borderBottom: "1px solid #1a1a24" }}>
          {judgeScores.map((s) => (
            <JudgeScoreBadge
              key={s.criterion}
              score={s.score}
              label={s.criterion_name}
              reasoning={s.reasoning}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, padding: "10px 14px", overflowY: "auto", minHeight: 120 }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#666", animation: "fadeIn .3s" }}>
            <div style={{ width: 14, height: 14, border: "2px solid " + accent + "33", borderTopColor: accent, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            <span style={{ fontSize: 12 }}>Running...</span>
          </div>
        )}
        {hasError && (
          <div style={{ padding: "10px 12px", background: "#1a1015", border: "1px solid #3a1825", borderRadius: 8, color: "#f87171", fontSize: 12, lineHeight: 1.5 }}>
            <strong>Error: </strong>{result.error}
          </div>
        )}
        {result && !hasError && result.content && (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: "#c4c4d0" }} dangerouslySetInnerHTML={{ __html: renderMd(result.content) }} />
        )}
      </div>
    </div>
  );
}

function EvalSummaryBar({ compareModels, providers, evalResults, deterministicMetricsAll }) {
  if (!evalResults && !deterministicMetricsAll) return null;

  // Collect all criterion names from eval results
  const criteriaNames = [];
  if (evalResults) {
    for (const r of evalResults) {
      for (const s of (r.scores || [])) {
        if (!criteriaNames.find((c) => c.id === s.criterion)) {
          criteriaNames.push({ id: s.criterion, name: s.criterion_name });
        }
      }
    }
  }

  // Find winner per criterion
  const getWinner = (criterionId) => {
    if (!evalResults) return -1;
    let bestScore = 0;
    let bestIdx = -1;
    evalResults.forEach((r, i) => {
      const s = r.scores?.find((s) => s.criterion === criterionId);
      if (s && s.score > bestScore) {
        bestScore = s.score;
        bestIdx = i;
      }
    });
    return bestIdx;
  };

  return (
    <div style={{
      background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24",
      overflow: "hidden", animation: "fadeIn .3s",
    }}>
      <div style={{ padding: "10px 16px 8px", borderBottom: "1px solid #1a1a24", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>Evaluation Summary</span>
        {evalResults && (() => {
          const avgs = evalResults.map((r) => r.average).filter((a) => a != null);
          if (avgs.length === 0) return null;
          const bestAvg = Math.max(...avgs);
          const bestIdx = evalResults.findIndex((r) => r.average === bestAvg);
          const bestProv = providers.find((p) => p.id === compareModels[bestIdx]?.provider);
          return (
            <span style={{ fontSize: 11, color: bestProv?.color || "#a78bfa", fontWeight: 600 }}>
              Winner: {bestProv?.name || "?"} ({bestAvg.toFixed(1)}/5)
            </span>
          );
        })()}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1a1a24" }}>
              <th style={{ padding: "8px 14px", textAlign: "left", color: "#666", fontWeight: 500 }}>Criterion</th>
              {compareModels.map((cm, i) => {
                const prov = providers.find((p) => p.id === cm.provider);
                return (
                  <th key={i} style={{ padding: "8px 14px", textAlign: "center", color: prov?.color || "#888", fontWeight: 600 }}>
                    <Dot color={prov?.color || "#6366f1"} size={6} />{" "}
                    {prov?.name || cm.provider}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {criteriaNames.map((c) => {
              const winnerIdx = getWinner(c.id);
              return (
                <tr key={c.id} style={{ borderBottom: "1px solid #1a1a24" }}>
                  <td style={{ padding: "7px 14px", color: "#999" }}>{c.name}</td>
                  {compareModels.map((cm, i) => {
                    const evalResult = evalResults?.[i];
                    const score = evalResult?.scores?.find((s) => s.criterion === c.id);
                    const isWinner = winnerIdx === i;
                    const scoreColor = score?.score >= 4 ? "#22c55e" : score?.score >= 3 ? "#eab308" : score?.score > 0 ? "#ef4444" : "#555";
                    return (
                      <td key={i} style={{
                        padding: "7px 14px", textAlign: "center",
                        fontWeight: isWinner ? 700 : 400,
                        color: scoreColor,
                        background: isWinner ? scoreColor + "08" : "transparent",
                      }}>
                        {score?.score > 0 ? `${score.score}/5` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Average row */}
            {evalResults && (
              <tr style={{ borderTop: "2px solid #1e1e28" }}>
                <td style={{ padding: "8px 14px", color: "#ccc", fontWeight: 600 }}>Average</td>
                {compareModels.map((cm, i) => {
                  const avg = evalResults?.[i]?.average;
                  const allAvgs = evalResults.map((r) => r.average).filter((a) => a != null);
                  const isWinner = avg != null && avg === Math.max(...allAvgs);
                  return (
                    <td key={i} style={{
                      padding: "8px 14px", textAlign: "center",
                      fontWeight: 700, fontSize: 14,
                      color: isWinner ? "#a78bfa" : "#888",
                    }}>
                      {avg != null ? avg.toFixed(1) : "—"}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CompareView({ results, compareModels, providers, providerModels, onRemoveModel, input, evalResults, evalLoading }) {
  // Compute deterministic metrics for each result
  const deterministicMetricsAll = results
    ? results.map((r) => (r && !r.error && r.content) ? computeMetrics(input || "", r.content) : null)
    : null;

  // Determine best values for each metric (lower compression = better, higher vocab = better)
  const bestMetrics = {};
  if (deterministicMetricsAll) {
    const validMetrics = deterministicMetricsAll.filter(Boolean);
    if (validMetrics.length > 0) {
      // For compression ratio: lowest is best
      const compVals = validMetrics.map((m) => m.compressionRatio).filter((v) => v != null);
      if (compVals.length > 0) {
        const bestComp = Math.min(...compVals);
        deterministicMetricsAll.forEach((m, i) => {
          if (m && m.compressionRatio === bestComp) {
            bestMetrics[i] = { ...(bestMetrics[i] || {}), compressionRatio: true };
          }
        });
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 200 }}>
      {/* Result cards */}
      <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 200, overflowX: "auto" }}>
        {compareModels.map((cm, i) => {
          const prov = providers.find((p) => p.id === cm.provider);
          const result = results ? results[i] : null;
          const judgeScores = evalResults?.[i]?.scores?.filter((s) => s.score > 0) || null;
          return (
            <ResultCard
              key={cm.provider + "/" + cm.model + "/" + i}
              result={result}
              provider={prov}
              accent={prov?.color || "#6366f1"}
              onRemove={compareModels.length > 2 ? () => onRemoveModel(i) : undefined}
              deterministicMetrics={deterministicMetricsAll ? deterministicMetricsAll[i] : null}
              judgeScores={judgeScores}
              bestMetrics={bestMetrics[i]}
              input={input}
            />
          );
        })}
      </div>

      {/* Evaluation loading indicator */}
      {evalLoading && (
        <div style={{
          background: "#0e0e16", borderRadius: 14, border: "1px solid #1a1a24",
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          animation: "fadeIn .3s",
        }}>
          <div style={{ width: 16, height: 16, border: "2px solid #a78bfa33", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
          <span style={{ fontSize: 13, color: "#888" }}>Evaluating with LLM judge...</span>
        </div>
      )}

      {/* Evaluation summary table */}
      {evalResults && (
        <EvalSummaryBar
          compareModels={compareModels}
          providers={providers}
          evalResults={evalResults}
          deterministicMetricsAll={deterministicMetricsAll}
        />
      )}
    </div>
  );
}
