"""Tests for llmlab.server API endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── GET /api/providers ──


class TestListProviders:
    def test_returns_200(self, client):
        resp = client.get("/api/providers")
        assert resp.status_code == 200

    def test_returns_list(self, client):
        resp = client.get("/api/providers")
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 8

    def test_provider_fields(self, client):
        resp = client.get("/api/providers")
        for p in resp.json():
            assert "id" in p
            assert "name" in p
            assert "needsKey" in p


# ── GET /api/models/{provider_id} ──


class TestListModels:
    def test_valid_provider(self, client):
        resp = client.get("/api/models/anthropic")
        assert resp.status_code == 200
        data = resp.json()
        assert "models" in data
        assert isinstance(data["models"], list)

    def test_invalid_provider_404(self, client):
        resp = client.get("/api/models/nonexistent")
        assert resp.status_code == 404

    def test_models_have_structure(self, client):
        resp = client.get("/api/models/openai")
        data = resp.json()
        if data["models"]:
            m = data["models"][0]
            assert "id" in m
            assert "name" in m
            assert "category" in m


# ── POST /api/chat ──


class TestChat:
    def test_unknown_provider_404(self, client):
        resp = client.post("/api/chat", json={
            "provider": "nonexistent",
            "model": "some-model",
            "messages": [{"role": "user", "content": "hi"}],
        })
        assert resp.status_code == 404

    def test_missing_api_key_400(self, client):
        resp = client.post("/api/chat", json={
            "provider": "anthropic",
            "model": "claude-3-opus",
            "messages": [{"role": "user", "content": "hi"}],
        })
        assert resp.status_code == 400
        assert "API key" in resp.json()["detail"]

    def test_ollama_no_key_required(self, client):
        """Ollama doesn't need a key, so it should not return 400 for missing key."""
        with patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock) as mock_comp:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock(message=MagicMock(content="Hello!"))]
            mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
            mock_response.model = "ollama/llama3"
            mock_comp.return_value = mock_response

            resp = client.post("/api/chat", json={
                "provider": "ollama",
                "model": "llama3",
                "messages": [{"role": "user", "content": "hi"}],
            })
            # Should not be 400 (no key needed)
            assert resp.status_code != 400

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_successful_chat(self, mock_comp, client):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Test response"))]
        mock_response.usage = MagicMock(prompt_tokens=15, completion_tokens=10)
        mock_response.model = "anthropic/claude-3-opus"
        mock_comp.return_value = mock_response

        resp = client.post("/api/chat", json={
            "provider": "anthropic",
            "model": "claude-3-opus",
            "messages": [{"role": "user", "content": "hello"}],
            "api_key": "sk-ant-test-key",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Test response"
        assert data["usage"]["input_tokens"] == 15
        assert data["usage"]["output_tokens"] == 10
        assert data["model"] == "anthropic/claude-3-opus"

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_chat_passes_max_tokens(self, mock_comp, client):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="ok"))]
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=1)
        mock_response.model = "openai/gpt-4o"
        mock_comp.return_value = mock_response

        client.post("/api/chat", json={
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "hi"}],
            "api_key": "sk-test",
            "max_tokens": 4096,
        })
        _, kwargs = mock_comp.call_args
        assert kwargs["max_tokens"] == 4096

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_chat_litellm_error_500(self, mock_comp, client):
        mock_comp.side_effect = Exception("Rate limit exceeded")

        resp = client.post("/api/chat", json={
            "provider": "openai",
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": "hello"}],
            "api_key": "sk-test",
        })
        assert resp.status_code == 500
        assert "Rate limit exceeded" in resp.json()["detail"]

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_chat_ollama_sets_api_base(self, mock_comp, client):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="hi"))]
        mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=1)
        mock_response.model = "ollama/llama3"
        mock_comp.return_value = mock_response

        client.post("/api/chat", json={
            "provider": "ollama",
            "model": "llama3",
            "messages": [{"role": "user", "content": "hi"}],
        })
        _, kwargs = mock_comp.call_args
        assert "api_base" in kwargs

    def test_invalid_request_body(self, client):
        resp = client.post("/api/chat", json={"bad": "data"})
        assert resp.status_code == 422  # Pydantic validation error


# ── POST /api/chat/compare ──


class TestCompare:
    def test_too_few_models_400(self, client):
        resp = client.post("/api/chat/compare", json={
            "models": [{"provider": "anthropic", "model": "claude-3-opus", "api_key": "sk-test"}],
            "messages": [{"role": "user", "content": "hi"}],
        })
        assert resp.status_code == 400
        assert "2-5" in resp.json()["detail"]

    def test_too_many_models_400(self, client):
        models = [{"provider": "openai", "model": f"m{i}", "api_key": "sk"} for i in range(6)]
        resp = client.post("/api/chat/compare", json={
            "models": models,
            "messages": [{"role": "user", "content": "hi"}],
        })
        assert resp.status_code == 400

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_successful_compare(self, mock_comp, client):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content="Response"))]
        mock_response.usage = MagicMock(prompt_tokens=10, completion_tokens=5)
        mock_response.model = "test-model"
        mock_comp.return_value = mock_response

        resp = client.post("/api/chat/compare", json={
            "models": [
                {"provider": "anthropic", "model": "claude-3-opus", "api_key": "sk-ant-test"},
                {"provider": "openai", "model": "gpt-4o", "api_key": "sk-test"},
            ],
            "messages": [{"role": "user", "content": "hello"}],
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 2
        for r in data["results"]:
            assert r["content"] == "Response"
            assert r["error"] is None
            assert "latency_ms" in r

    @patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock)
    def test_compare_partial_failure(self, mock_comp, client):
        """One model succeeds, one fails — both results returned."""
        call_count = 0
        async def side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                resp = MagicMock()
                resp.choices = [MagicMock(message=MagicMock(content="OK"))]
                resp.usage = MagicMock(prompt_tokens=5, completion_tokens=2)
                resp.model = "model-a"
                return resp
            raise Exception("Model B failed")

        mock_comp.side_effect = side_effect

        resp = client.post("/api/chat/compare", json={
            "models": [
                {"provider": "anthropic", "model": "a", "api_key": "sk-a"},
                {"provider": "openai", "model": "b", "api_key": "sk-b"},
            ],
            "messages": [{"role": "user", "content": "hi"}],
        })
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert len(results) == 2
        # One should succeed, one should have error
        errors = [r for r in results if r["error"]]
        successes = [r for r in results if not r.get("error")]
        assert len(successes) == 1
        assert len(errors) == 1
        assert "Model B failed" in errors[0]["error"]

    def test_compare_missing_key(self, client):
        """Provider needing key but not given — returns error in result, not 400."""
        with patch("llmlab.server.litellm.acompletion", new_callable=AsyncMock) as mock_comp:
            mock_response = MagicMock()
            mock_response.choices = [MagicMock(message=MagicMock(content="OK"))]
            mock_response.usage = MagicMock(prompt_tokens=5, completion_tokens=2)
            mock_response.model = "ollama/llama3"
            mock_comp.return_value = mock_response

            resp = client.post("/api/chat/compare", json={
                "models": [
                    {"provider": "anthropic", "model": "opus"},  # no key
                    {"provider": "ollama", "model": "llama3"},   # no key needed
                ],
                "messages": [{"role": "user", "content": "hi"}],
            })
            assert resp.status_code == 200
            results = resp.json()["results"]
            # Anthropic should have error about key
            anthropic_result = next(r for r in results if r["provider"] == "anthropic")
            assert "API key" in anthropic_result["error"]
            # Ollama should succeed
            ollama_result = next(r for r in results if r["provider"] == "ollama")
            assert ollama_result["error"] is None


# ── GET / (root) ──


class TestServeIndex:
    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200


# ── CORS ──


class TestCORS:
    def test_cors_headers_on_options(self, client):
        resp = client.options("/api/providers", headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        })
        assert resp.status_code == 200
        assert "access-control-allow-origin" in resp.headers
