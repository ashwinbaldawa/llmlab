// Provider UI metadata only — models are fetched from the backend
const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", color: "#d4a27f", needsKey: true },
  { id: "openai", name: "OpenAI", color: "#10a37f", needsKey: true },
  { id: "gemini", name: "Google Gemini", color: "#4285f4", needsKey: true },
  { id: "deepseek", name: "DeepSeek", color: "#0ea5e9", needsKey: true },
  { id: "groq", name: "Groq", color: "#f97316", needsKey: true },
  { id: "openrouter", name: "OpenRouter", color: "#6366f1", needsKey: true },
  { id: "huggingface", name: "Hugging Face", color: "#fbbf24", needsKey: true },
  { id: "ollama", name: "Ollama (Local)", color: "#22c55e", needsKey: false },
];

export default PROVIDERS;
