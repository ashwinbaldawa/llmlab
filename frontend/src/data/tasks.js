const TASKS = [
  {
    id: "summarize",
    label: "Summarize",
    icon: "📝",
    accent: "#34d399",
    ph: "Paste article, report, or long text…",
    file: { acc: ".txt,.md,.pdf,.csv,.json", mx: 3, mb: 10, hint: "PDF, TXT, CSV, JSON" },
    opts: [
      { id: "len", l: "Length", t: "sel", ch: ["Brief (1-2 sentences)", "Medium (paragraph)", "Detailed (multi-paragraph)"], d: "Medium (paragraph)" },
      { id: "fmt", l: "Format", t: "sel", ch: ["Bullet Points", "Prose", "TL;DR + Key Points", "Executive Summary"], d: "Bullet Points" },
      { id: "focus", l: "Focus", t: "sel", ch: ["General", "Facts & Figures", "Conclusions", "Actions & Decisions"], d: "General" },
      { id: "aud", l: "Audience", t: "sel", ch: ["General", "Technical", "Executive", "Academic"], d: "General" },
    ],
    bp: (i, o) =>
      `Summarize the following text.\n- Length: ${o.len}\n- Format: ${o.fmt}\n- Focus: ${o.focus}\n- Audience: ${o.aud}\n\nText:\n${i}`,
    metrics: [
      { id: "c1", l: "Conciseness", d: "Brevity vs original" },
      { id: "c2", l: "Coverage", d: "Key points retained" },
      { id: "c3", l: "Coherence", d: "Logical flow" },
      { id: "c4", l: "Faithfulness", d: "No hallucinations" },
    ],
  },
  {
    id: "classify",
    label: "Classify",
    icon: "🏷️",
    accent: "#f59e0b",
    ph: "Enter text to classify…",
    file: { acc: ".txt,.csv,.json,.tsv", mx: 5, mb: 5, hint: "CSV, JSON, TSV — batch mode" },
    opts: [
      { id: "type", l: "Classification Types", t: "multi", ch: ["Sentiment", "Topic", "Intent", "Urgency", "Language", "Toxicity"], d: ["Sentiment", "Topic"] },
      { id: "labels", l: "Custom Labels", t: "txt", d: "", placeholder: "Bug, Feature, Question…" },
      { id: "conf", l: "Show Confidence %", t: "tog", d: true },
      { id: "expl", l: "Explanations", t: "tog", d: true },
    ],
    bp: (i, o) =>
      `Classify this text across: ${(o.type || []).join(", ")}.\n${o.labels ? `Use only these labels: ${o.labels}\n` : ""}${o.conf ? "Include confidence percentages.\n" : ""}${o.expl ? "Explain each classification.\n" : ""}\nText:\n${i}`,
    metrics: [
      { id: "a1", l: "Accuracy", d: "Correct categories" },
      { id: "a2", l: "Confidence", d: "Well calibrated" },
      { id: "a3", l: "Explanations", d: "Reasoning quality" },
    ],
  },
  {
    id: "search",
    label: "Web Search",
    icon: "🔍",
    accent: "#3b82f6",
    ph: "Ask a question requiring current information…",
    search: true,
    opts: [
      { id: "depth", l: "Research Depth", t: "sel", ch: ["Quick Answer", "Moderate Research", "Deep Dive"], d: "Moderate Research" },
      { id: "src", l: "Preferred Sources", t: "multi", ch: ["News", "Academic", "Official/Gov", "Blogs", "Any"], d: ["Any"] },
      { id: "time", l: "Recency", t: "sel", ch: ["Last 24h", "Last week", "Last month", "Any time"], d: "Any time" },
      { id: "cite", l: "Cite Sources", t: "tog", d: true },
    ],
    bp: (i, o) =>
      `Research assistant. Depth: ${o.depth}. Sources: ${(o.src || []).join(", ")}. Recency: ${o.time}.${o.cite ? " Cite all sources with URLs." : ""}\n\nQuery:\n${i}`,
    metrics: [
      { id: "s1", l: "Relevance", d: "Matches query" },
      { id: "s2", l: "Recency", d: "Up to date" },
      { id: "s3", l: "Sources", d: "Credible & cited" },
      { id: "s4", l: "Completeness", d: "Thorough" },
    ],
  },
  {
    id: "extract",
    label: "Extract",
    icon: "⛏️",
    accent: "#a855f7",
    ph: "Paste text containing data to extract…",
    file: { acc: ".txt,.pdf,.csv,.json,.png,.jpg,.jpeg", mx: 5, mb: 10, hint: "PDF, images, TXT, CSV" },
    opts: [
      { id: "ent", l: "Entity Types", t: "multi", ch: ["Names", "Dates", "Emails", "Phones", "Addresses", "Money", "Organizations", "URLs"], d: ["Names", "Dates", "Emails"] },
      { id: "fmt", l: "Output Format", t: "sel", ch: ["JSON", "Table", "CSV", "Key-Value Pairs"], d: "Table" },
      { id: "dedup", l: "Deduplicate", t: "tog", d: true },
    ],
    bp: (i, o) =>
      `Extract these entities: ${(o.ent || []).join(", ")}.\nOutput format: ${o.fmt}.${o.dedup ? " Deduplicate entries." : ""}\n\nText:\n${i}`,
    metrics: [
      { id: "e1", l: "Precision", d: "Items correct" },
      { id: "e2", l: "Recall", d: "All found" },
      { id: "e3", l: "Format", d: "Clean structure" },
    ],
  },
  {
    id: "translate",
    label: "Translate",
    icon: "🌐",
    accent: "#06b6d4",
    ph: "Enter text to translate…",
    file: { acc: ".txt,.md,.srt,.vtt,.json", mx: 3, mb: 5, hint: "TXT, MD, SRT/VTT subtitles" },
    opts: [
      { id: "from", l: "Source Language", t: "sel", ch: ["Auto-Detect", "English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Portuguese", "Russian"], d: "Auto-Detect" },
      { id: "to", l: "Target Language", t: "sel", ch: ["English", "Spanish", "French", "German", "Chinese (Simplified)", "Japanese", "Korean", "Hindi", "Arabic", "Portuguese", "Russian", "Italian", "Dutch", "Turkish"], d: "Spanish" },
      { id: "form", l: "Formality", t: "sel", ch: ["Informal", "Neutral", "Formal"], d: "Neutral" },
      { id: "alt", l: "Show Alternatives", t: "tog", d: false },
    ],
    bp: (i, o) =>
      `Translate from ${o.from} to ${o.to}. Formality: ${o.form}.${o.alt ? " Provide alternative translations for ambiguous phrases." : ""}\n\nText:\n${i}`,
    metrics: [
      { id: "t1", l: "Fluency", d: "Natural in target" },
      { id: "t2", l: "Adequacy", d: "Meaning preserved" },
      { id: "t3", l: "Terminology", d: "Terms correct" },
    ],
  },
  {
    id: "generate",
    label: "Generate",
    icon: "✨",
    accent: "#ef4444",
    ph: "Describe what content you want created…",
    file: { acc: ".txt,.md,.pdf,.json,.png,.jpg,.jpeg", mx: 3, mb: 10, hint: "Reference docs or images" },
    opts: [
      { id: "type", l: "Content Type", t: "sel", ch: ["Email", "Blog Post", "Social Media", "Code", "Story/Creative", "Product Description", "Technical Docs"], d: "Email" },
      { id: "tone", l: "Tone", t: "sel", ch: ["Professional", "Casual", "Friendly", "Persuasive", "Academic", "Humorous", "Inspirational"], d: "Professional" },
      { id: "len", l: "Target Length", t: "sel", ch: ["Short (~100 words)", "Medium (~300 words)", "Long (~600 words)", "Very Long (~1000+ words)"], d: "Medium (~300 words)" },
      { id: "creat", l: "Creativity Level", t: "sli", min: 0, max: 10, d: 5 },
    ],
    bp: (i, o) =>
      `Generate content.\n- Type: ${o.type}\n- Tone: ${o.tone}\n- Length: ${o.len}\n- Creativity: ${o.creat}/10\n\nRequest:\n${i}`,
    metrics: [
      { id: "g1", l: "Creativity", d: "Originality" },
      { id: "g2", l: "Relevance", d: "On prompt" },
      { id: "g3", l: "Tone", d: "Voice match" },
      { id: "g4", l: "Structure", d: "Well organized" },
    ],
  },
  {
    id: "rewrite",
    label: "Rewrite",
    icon: "🔄",
    accent: "#eab308",
    ph: "Paste text you want rewritten…",
    file: { acc: ".txt,.md,.pdf,.html", mx: 2, mb: 5, hint: "TXT, MD, PDF, HTML" },
    opts: [
      { id: "sty", l: "Target Style", t: "sel", ch: ["More Formal", "More Casual", "Simpler (5th Grade)", "More Concise", "More Detailed", "More Persuasive", "Academic", "Technical → Layman"], d: "More Concise" },
      { id: "keep", l: "Preserve Length", t: "tog", d: false },
      { id: "diff", l: "Highlight Changes", t: "tog", d: true },
      { id: "vars", l: "Variants", t: "sel", ch: ["1", "2", "3"], d: "1" },
    ],
    bp: (i, o) =>
      `Rewrite in this style: ${o.sty}.${o.keep ? " Preserve approximate length." : ""}${o.diff ? " List key changes after." : ""}\nProvide ${o.vars} variant(s).\n\nOriginal:\n${i}`,
    metrics: [
      { id: "r1", l: "Meaning", d: "Core preserved" },
      { id: "r2", l: "Style Shift", d: "Tone changed" },
      { id: "r3", l: "Readability", d: "Improved" },
    ],
  },
  {
    id: "analyze",
    label: "Analyze",
    icon: "📊",
    accent: "#64748b",
    ph: "Paste text, data, or arguments to analyze…",
    file: { acc: ".txt,.md,.pdf,.csv,.json,.png,.jpg,.jpeg", mx: 5, mb: 10, hint: "PDF, CSV, JSON, images, TXT" },
    opts: [
      { id: "type", l: "Analysis Types", t: "multi", ch: ["Strengths & Weaknesses", "Logical Structure", "Bias Detection", "Fact Check", "Readability", "SWOT"], d: ["Strengths & Weaknesses", "Logical Structure"] },
      { id: "persp", l: "Perspective", t: "sel", ch: ["Neutral/Objective", "Critical", "Supportive", "Devil's Advocate"], d: "Neutral/Objective" },
      { id: "depth", l: "Depth", t: "sel", ch: ["Quick Review", "Standard Analysis", "Deep Dive"], d: "Standard Analysis" },
      { id: "recs", l: "Include Recommendations", t: "tog", d: true },
    ],
    bp: (i, o) =>
      `Analyze this text.\n- Types: ${(o.type || []).join(", ")}\n- Perspective: ${o.persp}\n- Depth: ${o.depth}${o.recs ? "\n- Include actionable recommendations." : ""}\n\nText:\n${i}`,
    metrics: [
      { id: "n1", l: "Depth", d: "Thoroughness" },
      { id: "n2", l: "Objectivity", d: "Balanced view" },
      { id: "n3", l: "Actionable", d: "Useful recommendations" },
    ],
  },
];

export default TASKS;
