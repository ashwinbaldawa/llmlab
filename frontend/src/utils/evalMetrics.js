/**
 * Deterministic evaluation metrics computed client-side.
 * These are instant, free, and require no LLM judge.
 */

/**
 * Count words in text (splits on whitespace).
 */
export function wordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Count sentences (splits on .!? followed by space or end).
 */
export function sentenceCount(text) {
  if (!text || !text.trim()) return 0;
  const sentences = text.trim().split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  return Math.max(sentences.length, 1);
}

/**
 * Character count (excluding leading/trailing whitespace).
 */
export function charCount(text) {
  if (!text) return 0;
  return text.trim().length;
}

/**
 * Compression ratio: output length / input length.
 * Lower = more concise. Returns null if input is empty.
 */
export function compressionRatio(input, output) {
  if (!input || !input.trim()) return null;
  if (!output) return 0;
  return output.trim().length / input.trim().length;
}

/**
 * Flesch-Kincaid Grade Level.
 * Approximates US school grade level needed to read the text.
 * Uses simple syllable counting heuristic.
 */
export function readingLevel(text) {
  if (!text || !text.trim()) return null;
  const words = text.trim().split(/\s+/);
  const wc = words.length;
  if (wc < 3) return null;
  const sc = sentenceCount(text);
  let syllables = 0;
  for (const word of words) {
    syllables += countSyllables(word);
  }
  // Flesch-Kincaid Grade Level formula
  const grade = 0.39 * (wc / sc) + 11.8 * (syllables / wc) - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * Approximate syllable count for an English word.
 */
export function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;
  let count = 0;
  const vowels = "aeiouy";
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  // Silent e
  if (w.endsWith("e") && count > 1) count--;
  // -le at end counts as syllable
  if (w.endsWith("le") && w.length > 2 && !vowels.includes(w[w.length - 3])) count++;
  return Math.max(count, 1);
}

/**
 * Vocabulary richness: unique words / total words (type-token ratio).
 * Higher = more diverse vocabulary. Range 0-1.
 */
export function vocabularyRichness(text) {
  if (!text || !text.trim()) return null;
  const words = text.trim().toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return null;
  const unique = new Set(words);
  return Math.round((unique.size / words.length) * 100) / 100;
}

/**
 * Compute all deterministic metrics for a single output.
 * Returns an object with metric values.
 */
export function computeMetrics(input, output) {
  return {
    wordCount: wordCount(output),
    charCount: charCount(output),
    sentenceCount: sentenceCount(output),
    compressionRatio: compressionRatio(input, output),
    readingLevel: readingLevel(output),
    vocabularyRichness: vocabularyRichness(output),
  };
}

/**
 * Compute metrics for multiple outputs (compare mode).
 * Returns array of metric objects, one per output.
 */
export function computeCompareMetrics(input, outputs) {
  return outputs.map((output) => computeMetrics(input, output));
}

/**
 * Format a metric value for display.
 */
export function formatMetric(key, value) {
  if (value === null || value === undefined) return "—";
  switch (key) {
    case "wordCount":
      return `${value} words`;
    case "charCount":
      return `${value} chars`;
    case "sentenceCount":
      return `${value} sent.`;
    case "compressionRatio":
      return `${(value * 100).toFixed(0)}%`;
    case "readingLevel":
      return `Grade ${value}`;
    case "vocabularyRichness":
      return `${(value * 100).toFixed(0)}%`;
    default:
      return String(value);
  }
}

/**
 * Metric display labels.
 */
export const METRIC_LABELS = {
  wordCount: "Word Count",
  charCount: "Characters",
  sentenceCount: "Sentences",
  compressionRatio: "Compression",
  readingLevel: "Reading Level",
  vocabularyRichness: "Vocab Richness",
};
