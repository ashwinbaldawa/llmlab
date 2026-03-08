import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadHistory, saveRun, deleteRun, clearHistory } from "./history";

describe("history utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadHistory returns empty array when no data", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saveRun adds entry to history", () => {
    const result = saveRun({ input: "test", output: "result" });
    expect(result).toHaveLength(1);
    expect(result[0].input).toBe("test");
    expect(result[0].output).toBe("result");
    expect(result[0].id).toBeDefined();
    expect(result[0].ts).toBeDefined();
  });

  it("saveRun prepends (newest first)", () => {
    saveRun({ input: "first" });
    const result = saveRun({ input: "second" });
    expect(result).toHaveLength(2);
    expect(result[0].input).toBe("second");
    expect(result[1].input).toBe("first");
  });

  it("saveRun persists to localStorage", () => {
    saveRun({ input: "test" });
    const loaded = loadHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].input).toBe("test");
  });

  it("saveRun caps at 50 entries", () => {
    for (let i = 0; i < 55; i++) {
      saveRun({ input: `entry-${i}` });
    }
    const result = loadHistory();
    expect(result).toHaveLength(50);
    // Most recent should be entry-54
    expect(result[0].input).toBe("entry-54");
  });

  it("deleteRun removes specific entry", () => {
    saveRun({ input: "keep" });
    const history = saveRun({ input: "delete-me" });
    const toDelete = history[0].id; // newest
    const result = deleteRun(toDelete);
    expect(result).toHaveLength(1);
    expect(result[0].input).toBe("keep");
  });

  it("deleteRun persists changes", () => {
    const history = saveRun({ input: "only" });
    deleteRun(history[0].id);
    expect(loadHistory()).toHaveLength(0);
  });

  it("clearHistory removes all entries", () => {
    saveRun({ input: "a" });
    saveRun({ input: "b" });
    const result = clearHistory();
    expect(result).toEqual([]);
    expect(loadHistory()).toEqual([]);
  });

  it("loadHistory handles corrupted localStorage gracefully", () => {
    localStorage.setItem("llmlab_history", "not-json");
    expect(loadHistory()).toEqual([]);
  });
});
