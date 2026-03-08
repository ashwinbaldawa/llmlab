"""Tests for llmlab.providers module."""

import pytest

from llmlab.providers import (
    PROVIDER_META,
    PROVIDER_ORDER,
    _categorize_model,
    _extract_date,
    _format_ctx,
    get_models,
    get_provider,
    get_providers,
    to_litellm_model,
)


# ── _format_ctx ──


class TestFormatCtx:
    def test_millions(self):
        assert _format_ctx(2_000_000) == "2M"

    def test_one_million(self):
        assert _format_ctx(1_000_000) == "1M"

    def test_thousands(self):
        assert _format_ctx(128_000) == "128K"

    def test_small_thousands(self):
        assert _format_ctx(4_000) == "4K"

    def test_none(self):
        assert _format_ctx(None) == "?"

    def test_zero(self):
        assert _format_ctx(0) == "?"


# ── _extract_date ──


class TestExtractDate:
    def test_yyyymmdd_format(self):
        assert _extract_date("claude-opus-4-5-20251101") == "2025-11-01"

    def test_yyyy_mm_dd_format(self):
        assert _extract_date("gpt-4o-2024-08-06") == "2024-08-06"

    def test_mm_dd_suffix(self):
        assert _extract_date("gemini-2.5-pro-preview-05-06") == "2025-05-06"

    def test_no_date(self):
        assert _extract_date("llama3") == "0000-00-00"

    def test_no_date_plain_name(self):
        assert _extract_date("mistral-tiny") == "0000-00-00"

    def test_yyyymmdd_boundary_year(self):
        # Year outside 2020-2030 range should not match the YYYYMMDD pattern
        result = _extract_date("model-20190101")
        assert result == "0000-00-00"


# ── _categorize_model ──


class TestCategorizeModel:
    def test_reasoning_model(self):
        info = {"supports_reasoning": True, "input_cost_per_token": 1e-5}
        assert _categorize_model("o1-preview", info) == "Reasoning"

    def test_flagship_by_cost(self):
        info = {"input_cost_per_token": 5e-6}  # $5/M tokens
        assert _categorize_model("claude-opus", info) == "Flagship"

    def test_flagship_at_boundary(self):
        info = {"input_cost_per_token": 3e-6}  # exactly $3/M
        assert _categorize_model("some-model", info) == "Flagship"

    def test_fast_by_cost(self):
        info = {"input_cost_per_token": 1e-7}  # $0.1/M tokens
        assert _categorize_model("gpt-4o-mini", info) == "Fast"

    def test_chat_middle_tier(self):
        info = {"input_cost_per_token": 1e-6}  # $1/M tokens
        assert _categorize_model("gpt-4o", info) == "Chat"

    def test_fallback_name_mini(self):
        info = {"input_cost_per_token": 0}
        assert _categorize_model("gpt-4o-mini", info) == "Fast"

    def test_fallback_name_flash(self):
        info = {"input_cost_per_token": 0}
        assert _categorize_model("gemini-flash", info) == "Fast"

    def test_fallback_name_opus(self):
        info = {"input_cost_per_token": 0}
        assert _categorize_model("claude-opus", info) == "Flagship"

    def test_fallback_name_8b(self):
        info = {"input_cost_per_token": 0}
        assert _categorize_model("llama-3.1-8b", info) == "Fast"

    def test_no_cost_no_name_hint(self):
        info = {"input_cost_per_token": 0}
        assert _categorize_model("some-model", info) == "Chat"

    def test_no_cost_data_at_all(self):
        info = {}
        assert _categorize_model("generic-model", info) == "Chat"


# ── get_providers ──


class TestGetProviders:
    def test_returns_all_8_providers(self):
        providers = get_providers()
        assert len(providers) == 8

    def test_correct_order(self):
        providers = get_providers()
        ids = [p["id"] for p in providers]
        assert ids == PROVIDER_ORDER

    def test_each_provider_has_required_fields(self):
        providers = get_providers()
        for p in providers:
            assert "id" in p
            assert "name" in p
            assert "color" in p
            assert "needsKey" in p

    def test_ollama_no_key_needed(self):
        providers = get_providers()
        ollama = next(p for p in providers if p["id"] == "ollama")
        assert ollama["needsKey"] is False

    def test_anthropic_needs_key(self):
        providers = get_providers()
        anthropic = next(p for p in providers if p["id"] == "anthropic")
        assert anthropic["needsKey"] is True


# ── get_provider ──


class TestGetProvider:
    def test_valid_provider(self):
        p = get_provider("anthropic")
        assert p is not None
        assert p["id"] == "anthropic"
        assert p["name"] == "Anthropic"

    def test_all_known_providers(self):
        for pid in PROVIDER_ORDER:
            assert get_provider(pid) is not None

    def test_invalid_provider(self):
        assert get_provider("nonexistent") is None

    def test_empty_string(self):
        assert get_provider("") is None


# ── get_models ──


class TestGetModels:
    def test_returns_list(self):
        models = get_models("anthropic")
        assert isinstance(models, list)

    def test_model_structure(self):
        models = get_models("openai")
        if models:
            m = models[0]
            assert "id" in m
            assert "name" in m
            assert "category" in m
            assert "ctx" in m

    def test_filters_non_chat_models(self):
        models = get_models("openai")
        for m in models:
            lower = m["id"].lower()
            assert "dall-e" not in lower
            assert "tts" not in lower
            assert "whisper" not in lower
            assert "embed" not in lower

    def test_categories_are_valid(self):
        models = get_models("anthropic")
        valid = {"Flagship", "Reasoning", "Chat", "Fast"}
        for m in models:
            assert m["category"] in valid

    def test_unknown_provider_returns_empty(self):
        models = get_models("nonexistent_provider")
        assert models == []

    def test_sorted_by_category_order(self):
        models = get_models("openai")
        if len(models) < 2:
            pytest.skip("Not enough models to test sorting")
        cat_order = {"Flagship": 0, "Reasoning": 1, "Chat": 2, "Fast": 3}
        indices = [cat_order.get(m["category"], 99) for m in models]
        # Within blocks, category order should be non-decreasing
        current_cat_blocks = []
        for idx in indices:
            if not current_cat_blocks or idx != current_cat_blocks[-1]:
                current_cat_blocks.append(idx)
        assert current_cat_blocks == sorted(current_cat_blocks)


# ── to_litellm_model ──


class TestToLitellmModel:
    def test_standard_provider(self):
        assert to_litellm_model("anthropic", "claude-3-opus") == "anthropic/claude-3-opus"

    def test_already_prefixed(self):
        assert to_litellm_model("anthropic", "anthropic/claude-3-opus") == "anthropic/claude-3-opus"

    def test_openrouter_with_slash(self):
        assert to_litellm_model("openrouter", "meta/llama-3") == "openrouter/meta/llama-3"

    def test_openrouter_without_slash(self):
        assert to_litellm_model("openrouter", "llama-3") == "openrouter/llama-3"

    def test_ollama(self):
        assert to_litellm_model("ollama", "llama3") == "ollama/llama3"

    def test_openai(self):
        assert to_litellm_model("openai", "gpt-4o") == "openai/gpt-4o"

    def test_gemini(self):
        assert to_litellm_model("gemini", "gemini-2.5-pro") == "gemini/gemini-2.5-pro"
