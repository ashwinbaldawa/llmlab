import { describe, it, expect } from "vitest";
import {
  wordCount,
  sentenceCount,
  charCount,
  compressionRatio,
  readingLevel,
  countSyllables,
  vocabularyRichness,
  computeMetrics,
  computeCompareMetrics,
  formatMetric,
  METRIC_LABELS,
} from "./evalMetrics";

describe("wordCount", () => {
  it("returns 0 for empty/null", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount(null)).toBe(0);
    expect(wordCount(undefined)).toBe(0);
    expect(wordCount("   ")).toBe(0);
  });

  it("counts words correctly", () => {
    expect(wordCount("hello world")).toBe(2);
    expect(wordCount("one")).toBe(1);
    expect(wordCount("the quick brown fox jumps")).toBe(5);
  });

  it("handles multiple spaces", () => {
    expect(wordCount("hello   world")).toBe(2);
    expect(wordCount("  hello  world  ")).toBe(2);
  });
});

describe("sentenceCount", () => {
  it("returns 0 for empty/null", () => {
    expect(sentenceCount("")).toBe(0);
    expect(sentenceCount(null)).toBe(0);
  });

  it("counts sentences", () => {
    expect(sentenceCount("Hello world.")).toBe(1);
    expect(sentenceCount("Hello. World.")).toBe(2);
    expect(sentenceCount("What? Yes! OK.")).toBe(3);
  });

  it("handles text without punctuation", () => {
    expect(sentenceCount("hello world")).toBe(1);
  });
});

describe("charCount", () => {
  it("returns 0 for empty/null", () => {
    expect(charCount("")).toBe(0);
    expect(charCount(null)).toBe(0);
  });

  it("counts characters (trimmed)", () => {
    expect(charCount("hello")).toBe(5);
    expect(charCount("  hello  ")).toBe(5);
  });
});

describe("compressionRatio", () => {
  it("returns null for empty input", () => {
    expect(compressionRatio("", "output")).toBeNull();
    expect(compressionRatio(null, "output")).toBeNull();
  });

  it("returns 0 for empty output", () => {
    expect(compressionRatio("some input", "")).toBe(0);
    expect(compressionRatio("some input", null)).toBe(0);
  });

  it("computes ratio correctly", () => {
    expect(compressionRatio("1234567890", "12345")).toBe(0.5);
    expect(compressionRatio("hello", "hello")).toBe(1);
  });
});

describe("countSyllables", () => {
  it("counts syllables for common words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("a")).toBe(1);
  });

  it("handles single letter words", () => {
    expect(countSyllables("I")).toBe(1);
  });
});

describe("readingLevel", () => {
  it("returns null for short/empty text", () => {
    expect(readingLevel("")).toBeNull();
    expect(readingLevel(null)).toBeNull();
    expect(readingLevel("Hi")).toBeNull();
  });

  it("returns a number for valid text", () => {
    const text = "The cat sat on the mat. It was a good day. The sun was shining brightly.";
    const level = readingLevel(text);
    expect(typeof level).toBe("number");
    expect(level).toBeGreaterThanOrEqual(0);
    expect(level).toBeLessThan(20);
  });
});

describe("vocabularyRichness", () => {
  it("returns null for empty text", () => {
    expect(vocabularyRichness("")).toBeNull();
    expect(vocabularyRichness(null)).toBeNull();
  });

  it("returns 1 for all unique words", () => {
    expect(vocabularyRichness("the cat sat")).toBe(1);
  });

  it("returns less than 1 for repeated words", () => {
    const result = vocabularyRichness("the the the cat");
    expect(result).toBeLessThan(1);
    expect(result).toBeGreaterThan(0);
  });
});

describe("computeMetrics", () => {
  it("returns all metric fields", () => {
    const result = computeMetrics("some input text", "output text here");
    expect(result).toHaveProperty("wordCount");
    expect(result).toHaveProperty("charCount");
    expect(result).toHaveProperty("sentenceCount");
    expect(result).toHaveProperty("compressionRatio");
    expect(result).toHaveProperty("readingLevel");
    expect(result).toHaveProperty("vocabularyRichness");
  });

  it("computes correct word count", () => {
    const result = computeMetrics("input", "one two three");
    expect(result.wordCount).toBe(3);
  });
});

describe("computeCompareMetrics", () => {
  it("returns array of metrics for each output", () => {
    const results = computeCompareMetrics("input", ["output one", "output two words here"]);
    expect(results).toHaveLength(2);
    expect(results[0].wordCount).toBe(2);
    expect(results[1].wordCount).toBe(4);
  });
});

describe("formatMetric", () => {
  it("formats word count", () => {
    expect(formatMetric("wordCount", 42)).toBe("42 words");
  });

  it("formats compression ratio as percentage", () => {
    expect(formatMetric("compressionRatio", 0.5)).toBe("50%");
  });

  it("formats reading level", () => {
    expect(formatMetric("readingLevel", 5.2)).toBe("Grade 5.2");
  });

  it("formats null as dash", () => {
    expect(formatMetric("wordCount", null)).toBe("—");
  });
});

describe("METRIC_LABELS", () => {
  it("has labels for all standard metrics", () => {
    expect(METRIC_LABELS.wordCount).toBe("Word Count");
    expect(METRIC_LABELS.charCount).toBe("Characters");
    expect(METRIC_LABELS.compressionRatio).toBe("Compression");
    expect(METRIC_LABELS.readingLevel).toBe("Reading Level");
    expect(METRIC_LABELS.vocabularyRichness).toBe("Vocab Richness");
  });
});
