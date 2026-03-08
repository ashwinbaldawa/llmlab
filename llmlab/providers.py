"""Provider config and model discovery via litellm's registry."""

import re
from datetime import date

import litellm

# UI metadata for providers — only display info, no hardcoded model lists
PROVIDER_META = {
    "anthropic": {"name": "Anthropic", "color": "#d4a27f", "needsKey": True, "keyPlaceholder": "sk-ant-..."},
    "openai": {"name": "OpenAI", "color": "#10a37f", "needsKey": True, "keyPlaceholder": "sk-proj-..."},
    "gemini": {"name": "Google Gemini", "color": "#4285f4", "needsKey": True, "keyPlaceholder": "AIzaSy..."},
    "deepseek": {"name": "DeepSeek", "color": "#0ea5e9", "needsKey": True, "keyPlaceholder": "sk-..."},
    "groq": {"name": "Groq", "color": "#f97316", "needsKey": True, "keyPlaceholder": "gsk_..."},
    "openrouter": {"name": "OpenRouter", "color": "#6366f1", "needsKey": True, "keyPlaceholder": "sk-or-..."},
    "huggingface": {"name": "Hugging Face", "color": "#fbbf24", "needsKey": True, "keyPlaceholder": "hf_..."},
    "ollama": {"name": "Ollama (Local)", "color": "#22c55e", "needsKey": False, "keyPlaceholder": ""},
}

# Ordered list of provider IDs for the UI
PROVIDER_ORDER = [
    "anthropic", "openai", "gemini", "deepseek",
    "groq", "openrouter", "huggingface", "ollama",
]

# Regex patterns to extract dates from model IDs
_DATE_YYYYMMDD = re.compile(r"(\d{4})(\d{2})(\d{2})")
_DATE_YYYY_MM_DD = re.compile(r"(\d{4})-(\d{2})-(\d{2})")
_DATE_MM_DD_SUFFIX = re.compile(r"-(\d{2})-(\d{2})$")

# Category ordering for display (lower = shown first)
_CATEGORY_ORDER = {"Flagship": 0, "Reasoning": 1, "Chat": 2, "Fast": 3}


def _format_ctx(max_input_tokens):
    """Format context window size for display."""
    if not max_input_tokens:
        return "?"
    k = max_input_tokens / 1000
    if k >= 1000:
        return f"{k / 1000:.0f}M"
    return f"{int(k)}K"


def _extract_date(model_id: str) -> str:
    """Extract a date string (YYYY-MM-DD) from a model ID for sorting.

    Returns '0000-00-00' if no date found (sorts last).
    """
    # Try YYYYMMDD (e.g. claude-opus-4-5-20251101)
    m = _DATE_YYYYMMDD.search(model_id)
    if m:
        y, mo, d = m.group(1), m.group(2), m.group(3)
        if 2020 <= int(y) <= 2030 and 1 <= int(mo) <= 12:
            return f"{y}-{mo}-{d}"

    # Try YYYY-MM-DD (e.g. gpt-4o-2024-08-06)
    m = _DATE_YYYY_MM_DD.search(model_id)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    # Try -MM-DD suffix (e.g. gemini-2.5-pro-preview-05-06)
    m = _DATE_MM_DD_SUFFIX.search(model_id)
    if m:
        return f"2025-{m.group(1)}-{m.group(2)}"

    return "0000-00-00"


def _categorize_model(model_id: str, info: dict) -> str:
    """Categorize a model into Flagship, Reasoning, Chat, or Fast.

    Uses litellm's supports_reasoning flag + cost-based tiering.
    Cost thresholds (per input token):
      >= $3/M  → Flagship (e.g. claude-opus, gpt-4o)
      <  $0.5/M → Fast (e.g. gpt-4o-mini, gemini-flash, haiku)
      middle   → Chat (standard tier)
    Reasoning models are categorized separately regardless of cost.
    """
    if info.get("supports_reasoning"):
        return "Reasoning"

    input_cost = info.get("input_cost_per_token") or 0

    # Cost-based tiers
    if input_cost >= 3e-6:  # >= $3/M tokens
        return "Flagship"
    if input_cost > 0 and input_cost < 5e-7:  # < $0.5/M tokens
        return "Fast"

    # If no cost data, fall back to name heuristics
    if input_cost == 0:
        lower = model_id.lower()
        if any(tag in lower for tag in ["mini", "flash", "lite", "instant", "nano", "8b", "7b"]):
            return "Fast"
        if any(tag in lower for tag in ["opus", "ultra"]):
            return "Flagship"

    return "Chat"


def get_providers():
    """Return provider list with UI metadata (no models)."""
    result = []
    for pid in PROVIDER_ORDER:
        meta = PROVIDER_META.get(pid)
        if meta:
            result.append({"id": pid, **meta})
    return result


def get_provider(provider_id: str):
    """Return a single provider's metadata, or None."""
    if provider_id in PROVIDER_META:
        return {"id": provider_id, **PROVIDER_META[provider_id]}
    return None


def get_models(provider_id: str):
    """Get models for a provider from litellm's built-in registry.

    Returns models categorized and sorted by release date (newest first).
    """
    raw_models = litellm.models_by_provider.get(provider_id, set())
    models = []

    for model_id in raw_models:
        # Look up metadata in litellm's model_cost registry
        info = litellm.model_cost.get(model_id, {})
        if not info:
            info = litellm.model_cost.get(f"{provider_id}/{model_id}", {})

        mode = info.get("mode", "chat")
        if mode not in ("chat", ""):
            continue

        # Skip deprecated models
        dep_date = info.get("deprecation_date")
        if dep_date and isinstance(dep_date, str) and len(dep_date) == 10:
            try:
                if dep_date <= str(date.today()):
                    continue
            except (ValueError, TypeError):
                pass

        # Skip non-chat models and deprecated/irrelevant variants by name
        lower = model_id.lower()
        if any(skip in lower for skip in [
            "dall-e", "tts", "whisper", "embed", "moderation",
            "image", "audio", "rerank",
            # Non-chat modalities
            "realtime", "vision", "robotics", "computer-use",
            # Search/tool-specific previews
            "search-preview", "search-api", "customtools",
            # Guard/safety models
            "guard", "safeguard",
            # Misc non-chat
            "container", "learnlm",
        ]):
            continue

        # Skip legacy/superseded model families
        # Strip provider prefix for matching (e.g. "gemini/gemini-exp-1206" → "gemini-exp-1206")
        bare = lower.split("/")[-1] if "/" in lower else lower
        if any(bare.startswith(prefix) for prefix in [
            "gpt-3.5",    # superseded by gpt-4o-mini
            "gpt-4-32k",  # discontinued
            "gpt-4-0314", "gpt-4-0613",  # old snapshots
            "gpt-4-1106", "gpt-4-0125",  # old previews
            "gemini-pro",   # 1.0 era
            "gemini-1.5-",  # 1.5 era
            "gemini-exp-",  # experimental
            "gemini-2.0-flash-thinking",  # thinking experiments
            "gemma-",       # open models via Gemini API
            "gemini-gemma-", # gemma via Gemini API
        ]) and "gpt-4o" not in bare and "gpt-4.1" not in bare:
            continue

        # Skip duplicate -latest aliases (prefer the base name)
        if lower.endswith("-latest"):
            continue

        max_input = info.get("max_input_tokens")
        ctx = _format_ctx(max_input)
        category = _categorize_model(model_id, info)
        release_date = _extract_date(model_id)

        # Clean display name: strip provider prefix if present
        display_name = model_id
        if "/" in display_name:
            display_name = display_name.split("/", 1)[-1]

        models.append({
            "id": model_id,
            "name": display_name,
            "category": category,
            "ctx": ctx,
            "release_date": release_date if release_date != "0000-00-00" else None,
            "input_cost": info.get("input_cost_per_token"),
            "output_cost": info.get("output_cost_per_token"),
        })

    # Deduplicate by display name (keep the one with provider prefix if both exist)
    seen_names = set()
    deduped = []
    for m in models:
        if m["name"] not in seen_names:
            seen_names.add(m["name"])
            deduped.append(m)
    models = deduped

    # Sort: by category order first, then newest release date first, then name
    models.sort(key=lambda m: (
        _CATEGORY_ORDER.get(m["category"], 99),
        -(ord(m["release_date"][0]) if m["release_date"] else 0),  # dummy
        m["release_date"] is None,  # models with dates first
        "".join(reversed(m["release_date"])) if m["release_date"] else "zzz",
        m["name"],
    ))
    # Better sort: category, then reverse date (newest first)
    models.sort(key=lambda m: (
        _CATEGORY_ORDER.get(m["category"], 99),
        "" if m["release_date"] is None else m["release_date"],
    ))
    # Reverse within each category by date (newest first)
    from itertools import groupby
    sorted_models = []
    for _cat, group in groupby(models, key=lambda m: m["category"]):
        group_list = list(group)
        group_list.sort(key=lambda m: m["release_date"] or "0000-00-00", reverse=True)
        sorted_models.extend(group_list)

    return sorted_models


def to_litellm_model(provider_id: str, model_id: str) -> str:
    """Convert provider + model to litellm model string."""
    if model_id.startswith(f"{provider_id}/"):
        return model_id

    if provider_id == "openrouter" and "/" in model_id:
        return f"openrouter/{model_id}"

    if provider_id == "ollama":
        return f"ollama/{model_id}"

    return f"{provider_id}/{model_id}"
