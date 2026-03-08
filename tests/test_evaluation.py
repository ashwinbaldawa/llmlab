"""Tests for llmlab.evaluation module and /api/evaluate endpoints."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from llmlab.evaluation import (
    CRITERIA,
    TASK_METRIC_MAP,
    _build_judge_prompt,
    _parse_judge_response,
    evaluate_comparison,
    evaluate_output,
    evaluate_single,
    get_criteria_list,
    resolve_criteria,
)


# ── Unit tests for evaluation module ──


class TestGetCriteriaList:
    def test_returns_all_criteria(self):
        result = get_criteria_list()
        assert isinstance(result, list)
        assert len(result) == len(CRITERIA)

    def test_criteria_have_required_fields(self):
        for c in get_criteria_list():
            assert "id" in c
            assert "name" in c
            assert "description" in c


class TestResolveCriteria:
    def test_resolves_standard_criteria(self):
        result = resolve_criteria(["faithfulness", "relevance"])
        assert len(result) == 2
        assert result[0]["id"] == "faithfulness"
        assert result[1]["id"] == "relevance"
        assert "rubric" in result[0]

    def test_resolves_task_metric_labels(self):
        result = resolve_criteria(["conciseness"])
        assert len(result) == 1
        assert result[0]["id"] == "conciseness"

    def test_raises_for_unknown_criterion(self):
        with pytest.raises(ValueError, match="Unknown criterion"):
            resolve_criteria(["nonexistent_criterion"])

    def test_deduplicates(self):
        result = resolve_criteria(["faithfulness", "faithfulness"])
        assert len(result) == 1

    def test_maps_task_labels_to_standard(self):
        result = resolve_criteria(["coverage"])
        assert result[0]["id"] == "completeness"


class TestBuildJudgePrompt:
    def test_contains_all_sections(self):
        criterion = {"name": "Test", "description": "Test desc", "rubric": "Score 1: bad\nScore 5: good"}
        prompt = _build_judge_prompt(criterion, "user input", "ai response")
        assert "Test" in prompt
        assert "Test desc" in prompt
        assert "user input" in prompt
        assert "ai response" in prompt
        assert "Score 1" in prompt
        assert "JSON" in prompt


class TestParseJudgeResponse:
    def test_parses_valid_json(self):
        result = _parse_judge_response('{"score": 4, "reasoning": "Good response"}')
        assert result["score"] == 4
        assert result["reasoning"] == "Good response"

    def test_parses_json_in_code_block(self):
        result = _parse_judge_response('```json\n{"score": 3, "reasoning": "OK"}\n```')
        assert result["score"] == 3

    def test_clamps_score_to_range(self):
        result = _parse_judge_response('{"score": 10, "reasoning": "too high"}')
        assert result["score"] == 5
        result = _parse_judge_response('{"score": 0, "reasoning": "too low"}')
        assert result["score"] == 1  # 0 is clamped to minimum valid score

    def test_fallback_regex_parsing(self):
        result = _parse_judge_response("Score: 4 because it was good.")
        assert result["score"] == 4

    def test_returns_zero_on_failure(self):
        result = _parse_judge_response("totally unparseable gibberish")
        assert result["score"] == 0


class TestTaskMetricMap:
    def test_all_mapped_values_exist_in_criteria(self):
        for label, criterion_id in TASK_METRIC_MAP.items():
            assert criterion_id in CRITERIA, f"Mapping '{label}' -> '{criterion_id}' not in CRITERIA"


# ── Async tests for evaluate functions ──


@pytest.mark.asyncio
class TestEvaluateSingle:
    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    async def test_successful_evaluation(self, mock_comp):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"score": 4, "reasoning": "Well done"}'))]
        mock_comp.return_value = mock_response

        criterion = {"id": "relevance", "name": "Relevance", "description": "Test", "rubric": "Score 1: bad"}
        result = await evaluate_single(
            "test input", "test output", criterion,
            "ollama", "llama3", None,
        )
        assert result["criterion"] == "relevance"
        assert result["score"] == 4
        assert result["reasoning"] == "Well done"
        assert result["error"] is None

    async def test_unknown_provider(self):
        criterion = {"id": "test", "name": "Test", "description": "Test", "rubric": ""}
        result = await evaluate_single(
            "input", "output", criterion,
            "nonexistent", "model", None,
        )
        assert result["score"] == 0
        assert "Unknown" in result["error"]

    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    async def test_llm_error_handled(self, mock_comp):
        mock_comp.side_effect = Exception("API error")
        criterion = {"id": "test", "name": "Test", "description": "Test", "rubric": ""}
        result = await evaluate_single(
            "input", "output", criterion,
            "ollama", "llama3", None,
        )
        assert result["score"] == 0
        assert "API error" in result["error"]


@pytest.mark.asyncio
class TestEvaluateOutput:
    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    async def test_evaluates_multiple_criteria(self, mock_comp):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"score": 4, "reasoning": "Good"}'))]
        mock_comp.return_value = mock_response

        criteria = resolve_criteria(["relevance", "coherence"])
        results = await evaluate_output(
            "test input", "test output", criteria,
            "ollama", "llama3", None,
        )
        assert len(results) == 2
        assert all(r["score"] == 4 for r in results)


@pytest.mark.asyncio
class TestEvaluateComparison:
    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    async def test_evaluates_multiple_outputs(self, mock_comp):
        call_count = 0
        async def side_effect(**kwargs):
            nonlocal call_count
            call_count += 1
            resp = MagicMock()
            # Alternate between scores 4 and 3
            score = 4 if call_count % 2 == 1 else 3
            resp.choices = [MagicMock(message=MagicMock(content=json.dumps({"score": score, "reasoning": "test"})))]
            return resp

        mock_comp.side_effect = side_effect

        outputs = [
            {"provider": "anthropic", "model": "claude", "content": "Response A"},
            {"provider": "openai", "model": "gpt-4", "content": "Response B"},
        ]
        criteria = resolve_criteria(["relevance"])
        results = await evaluate_comparison(
            "test input", outputs, criteria,
            "ollama", "llama3", None,
        )
        assert len(results) == 2
        assert results[0]["provider"] == "anthropic"
        assert results[1]["provider"] == "openai"
        assert results[0]["average"] is not None
        assert results[1]["average"] is not None

    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    async def test_handles_empty_output(self, mock_comp):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"score": 4, "reasoning": "ok"}'))]
        mock_comp.return_value = mock_response

        outputs = [
            {"provider": "a", "model": "m1", "content": "Valid response"},
            {"provider": "b", "model": "m2", "content": ""},  # empty
        ]
        criteria = resolve_criteria(["relevance"])
        results = await evaluate_comparison(
            "test input", outputs, criteria,
            "ollama", "llama3", None,
        )
        assert len(results) == 2
        # First should have scores, second should have empty
        assert results[0]["average"] is not None
        assert results[1]["scores"] == []


# ── API endpoint tests ──


class TestEvaluateCriteriaEndpoint:
    def test_returns_criteria(self, client):
        resp = client.get("/api/evaluate/criteria")
        assert resp.status_code == 200
        data = resp.json()
        assert "criteria" in data
        assert isinstance(data["criteria"], list)
        assert len(data["criteria"]) > 0
        for c in data["criteria"]:
            assert "id" in c
            assert "name" in c
            assert "description" in c


class TestEvaluateEndpoint:
    def test_empty_outputs_400(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [],
            "criteria": ["relevance"],
            "judge_provider": "ollama",
            "judge_model": "llama3",
        })
        assert resp.status_code == 400
        assert "No outputs" in resp.json()["detail"]

    def test_empty_criteria_400(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [{"provider": "a", "model": "m", "content": "resp"}],
            "criteria": [],
            "judge_provider": "ollama",
            "judge_model": "llama3",
        })
        assert resp.status_code == 400
        assert "No criteria" in resp.json()["detail"]

    def test_too_many_criteria_400(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [{"provider": "a", "model": "m", "content": "resp"}],
            "criteria": ["a", "b", "c", "d", "e", "f", "g", "h", "i"],
            "judge_provider": "ollama",
            "judge_model": "llama3",
        })
        assert resp.status_code == 400
        assert "Maximum 8" in resp.json()["detail"]

    def test_unknown_judge_provider_404(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [{"provider": "a", "model": "m", "content": "resp"}],
            "criteria": ["relevance"],
            "judge_provider": "nonexistent",
            "judge_model": "model",
        })
        assert resp.status_code == 404

    def test_missing_judge_key_400(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [{"provider": "a", "model": "m", "content": "resp"}],
            "criteria": ["relevance"],
            "judge_provider": "anthropic",
            "judge_model": "claude-3-opus",
        })
        assert resp.status_code == 400
        assert "API key" in resp.json()["detail"]

    def test_unknown_criterion_400(self, client):
        resp = client.post("/api/evaluate", json={
            "input_text": "test",
            "outputs": [{"provider": "a", "model": "m", "content": "resp"}],
            "criteria": ["totally_fake_criterion"],
            "judge_provider": "ollama",
            "judge_model": "llama3",
        })
        assert resp.status_code == 400
        assert "Unknown criterion" in resp.json()["detail"]

    @patch("llmlab.evaluation.litellm.acompletion", new_callable=AsyncMock)
    def test_successful_evaluation(self, mock_comp, client):
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content='{"score": 4, "reasoning": "Good"}'))]
        mock_comp.return_value = mock_response

        resp = client.post("/api/evaluate", json={
            "input_text": "test input",
            "outputs": [
                {"provider": "anthropic", "model": "claude", "content": "Response A"},
                {"provider": "openai", "model": "gpt-4", "content": "Response B"},
            ],
            "criteria": ["relevance", "coherence"],
            "judge_provider": "ollama",
            "judge_model": "llama3",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert len(data["results"]) == 2
        for r in data["results"]:
            assert "provider" in r
            assert "model" in r
            assert "scores" in r
            assert "average" in r
            assert len(r["scores"]) == 2

    def test_invalid_request_body(self, client):
        resp = client.post("/api/evaluate", json={"bad": "data"})
        assert resp.status_code == 422
