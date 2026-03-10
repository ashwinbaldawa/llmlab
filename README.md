# LLMLab

Test, compare, and evaluate LLM outputs across providers — all from one UI.

LLMLab is a local-first tool for prompt engineering and model evaluation. Pick a task, choose your models, tweak the prompt, and compare results side by side — with built-in LLM-as-judge scoring.

## What it does

- **8 task types** — Summarize, Classify, Extract, Translate, Generate, Rewrite, Analyze, Web Search — each with task-specific config options
- **8 providers** — Anthropic, OpenAI, Gemini, DeepSeek, Groq, OpenRouter, Hugging Face, Ollama (local)
- **Compare mode** — Run 2-5 models on the same prompt, see outputs side by side
- **LLM-as-judge evaluation** — Score outputs on criteria like relevance, coherence, helpfulness using a separate judge model (G-Eval style, 1-5 scale with reasoning)
- **Self-evaluation metrics** — Task-specific metrics appended to the prompt (e.g., Conciseness, Coverage for Summarize)
- **System prompt & sampling controls** — Set persona, temperature, top-p per run
- **Prompt preview & editing** — See and modify the exact prompt before sending
- **Run history** — Every run is saved locally for replay
- **File upload** — PDF, TXT, CSV, JSON, images depending on task

## Quick Start

```bash
# Install from PyPI
pip install llmlab-ai

# Or install from source
git clone https://github.com/ashwinbaldawa/llmlab.git
cd llmlab
pip install -e .

# Install frontend
cd frontend && npm install && cd ..

# Run (starts both backend + frontend dev server)
llmlab
```

Open [http://localhost:3000](http://localhost:3000). Add an API key in the Run Settings popup, and you're running.

## Architecture

```
llmlab/
├── llmlab/                 # Python backend (FastAPI + litellm)
│   ├── server.py           # API endpoints: /api/chat, /api/chat/compare, /api/evaluate
│   ├── providers.py        # Provider config, model discovery via litellm registry
│   ├── evaluation.py       # LLM-as-judge engine (G-Eval rubrics, pointwise scoring)
│   └── cli.py              # CLI entry point
├── frontend/               # React frontend (Vite)
│   └── src/
│       ├── App.jsx          # Main app (~1200 lines, single-file for now)
│       ├── components/      # CompareView, ModelPicker, FileZone, etc.
│       ├── data/            # Task definitions, provider metadata
│       └── utils/           # Eval metrics, file helpers, markdown renderer, history
├── tests/                  # pytest backend tests (99 tests)
└── pyproject.toml          # Package config
```

**Backend**: FastAPI serves the API. All LLM calls go through [litellm](https://github.com/BerriAI/litellm), which normalizes the interface across providers. Models are discovered dynamically from litellm's registry — no hardcoded model lists.

**Frontend**: React SPA with Vite. No UI framework — all inline styles. The frontend proxies `/api/*` to the backend during development.

## API Keys

Keys are entered in the Run Settings popup (shown before each run) and stay in browser memory only — never stored on disk or sent anywhere except to the respective provider's API.

| Provider | Get a key |
|---|---|
| Anthropic | https://console.anthropic.com/settings/keys |
| OpenAI | https://platform.openai.com/api-keys |
| Google Gemini | https://aistudio.google.com/apikey |
| DeepSeek | https://platform.deepseek.com/api_keys |
| Groq | https://console.groq.com/keys |
| OpenRouter | https://openrouter.ai/keys |
| Hugging Face | https://huggingface.co/settings/tokens |
| Ollama | No key needed — runs locally |

## Evaluation

### Self-eval metrics
Each task has built-in metrics (e.g., Conciseness, Coverage for Summarize). When selected, these are appended to the prompt asking the model to self-score 1-5.

### LLM-as-judge
After generation, a separate judge model scores each output on selected criteria (relevance, coherence, helpfulness, faithfulness, etc.) using G-Eval style rubrics. Works in both single and compare mode.

## Development

```bash
# Backend tests
pytest tests/ -q

# Frontend tests
cd frontend && npx vitest run

# Dev server with hot reload
llmlab --dev
```

## Using Ollama (free, local)

```bash
ollama pull llama3.2
ollama serve
```

The app detects Ollama automatically on `localhost:11434`. No API key needed.

## License

MIT
