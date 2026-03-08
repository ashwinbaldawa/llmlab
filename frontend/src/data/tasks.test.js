import { describe, it, expect } from "vitest";
import TASKS from "./tasks";

describe("tasks data", () => {
  it("has 8 tasks defined", () => {
    expect(TASKS).toHaveLength(8);
  });

  it("all task IDs are unique", () => {
    const ids = TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  const requiredFields = ["id", "label", "icon", "accent", "ph", "opts", "bp", "metrics"];

  TASKS.forEach((task) => {
    describe(`task: ${task.id}`, () => {
      requiredFields.forEach((field) => {
        it(`has required field '${field}'`, () => {
          expect(task).toHaveProperty(field);
        });
      });

      it("bp is a function", () => {
        expect(typeof task.bp).toBe("function");
      });

      it("bp returns a string with sample input", () => {
        const defaults = {};
        task.opts.forEach((o) => { defaults[o.id] = o.d; });
        const result = task.bp("Sample input text", defaults);
        expect(typeof result).toBe("string");
        expect(result.length).toBeGreaterThan(0);
      });

      it("bp includes the input text in output", () => {
        const defaults = {};
        task.opts.forEach((o) => { defaults[o.id] = o.d; });
        const result = task.bp("UNIQUE_TEST_INPUT", defaults);
        expect(result).toContain("UNIQUE_TEST_INPUT");
      });

      it("opts have valid types", () => {
        const validTypes = ["sel", "multi", "tog", "sli", "txt"];
        task.opts.forEach((o) => {
          expect(validTypes).toContain(o.t);
        });
      });

      it("opts have labels", () => {
        task.opts.forEach((o) => {
          expect(o.l).toBeTruthy();
        });
      });

      it("opts have default values", () => {
        task.opts.forEach((o) => {
          expect(o).toHaveProperty("d");
        });
      });

      it("sel/multi opts have choices", () => {
        task.opts.filter((o) => o.t === "sel" || o.t === "multi").forEach((o) => {
          expect(Array.isArray(o.ch)).toBe(true);
          expect(o.ch.length).toBeGreaterThan(0);
        });
      });

      it("metrics have unique IDs", () => {
        const mIds = task.metrics.map((m) => m.id);
        expect(new Set(mIds).size).toBe(mIds.length);
      });

      it("metrics have labels and descriptions", () => {
        task.metrics.forEach((m) => {
          expect(m.l).toBeTruthy();
          expect(m.d).toBeTruthy();
        });
      });
    });
  });

  it("task IDs match expected set", () => {
    const ids = TASKS.map((t) => t.id).sort();
    expect(ids).toEqual(["analyze", "classify", "extract", "generate", "rewrite", "search", "summarize", "translate"]);
  });

  it("search task has search flag", () => {
    const search = TASKS.find((t) => t.id === "search");
    expect(search.search).toBe(true);
  });

  it("tasks with file config have valid structure", () => {
    TASKS.filter((t) => t.file).forEach((t) => {
      expect(t.file.acc).toBeTruthy();
      expect(typeof t.file.mx).toBe("number");
      expect(typeof t.file.mb).toBe("number");
      expect(t.file.hint).toBeTruthy();
    });
  });
});
