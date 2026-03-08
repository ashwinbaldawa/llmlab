"""LLM-as-judge evaluation engine.

Supports pointwise scoring of model outputs using a configurable judge model.
Uses G-Eval style rubrics with chain-of-thought reasoning.
"""

import asyncio
import json
import re
from typing import Optional

import litellm

from .providers import get_provider, to_litellm_model

# ── Standard evaluation criteria with rubrics ──

CRITERIA = {
    # Tier 1 — universally relevant
    "faithfulness": {
        "name": "Faithfulness",
        "description": "Whether the output only contains claims supported by the input, with no hallucinations or fabricated information.",
        "rubric": (
            "Score 1: Output contains multiple fabricated claims not in the input.\n"
            "Score 2: Output contains some unsupported claims or embellishments.\n"
            "Score 3: Output is mostly faithful with minor unsupported details.\n"
            "Score 4: Output is faithful with at most one trivial unsupported detail.\n"
            "Score 5: Every claim in the output is directly supported by the input."
        ),
    },
    "relevance": {
        "name": "Relevance",
        "description": "Whether the output directly addresses the user's request and stays on topic.",
        "rubric": (
            "Score 1: Output is off-topic or ignores the request.\n"
            "Score 2: Output partially addresses the request but drifts significantly.\n"
            "Score 3: Output addresses the request but includes unnecessary tangents.\n"
            "Score 4: Output is relevant with minor tangential content.\n"
            "Score 5: Output directly and completely addresses the request."
        ),
    },
    "helpfulness": {
        "name": "Helpfulness",
        "description": "Whether the output provides practical, actionable, and useful information.",
        "rubric": (
            "Score 1: Output is unhelpful or misleading.\n"
            "Score 2: Output has limited practical value.\n"
            "Score 3: Output is somewhat helpful but lacks depth or actionability.\n"
            "Score 4: Output is helpful with good practical value.\n"
            "Score 5: Output is highly useful, actionable, and well-tailored to the request."
        ),
    },
    # Tier 2 — task-dependent
    "coherence": {
        "name": "Coherence",
        "description": "Whether the output is logically structured, well-organized, and flows naturally.",
        "rubric": (
            "Score 1: Output is disorganized and hard to follow.\n"
            "Score 2: Output has some structure but jumps between ideas.\n"
            "Score 3: Output is reasonably organized with minor flow issues.\n"
            "Score 4: Output is well-structured with clear logical flow.\n"
            "Score 5: Output is excellently organized with perfect logical progression."
        ),
    },
    "completeness": {
        "name": "Completeness",
        "description": "Whether the output covers all aspects of the request thoroughly.",
        "rubric": (
            "Score 1: Output addresses less than 20% of the request.\n"
            "Score 2: Output covers some aspects but misses major parts.\n"
            "Score 3: Output covers most aspects with some gaps.\n"
            "Score 4: Output is thorough with only minor omissions.\n"
            "Score 5: Output comprehensively covers all aspects of the request."
        ),
    },
    "conciseness": {
        "name": "Conciseness",
        "description": "Whether the output is efficiently expressed without unnecessary repetition or padding.",
        "rubric": (
            "Score 1: Output is extremely verbose with excessive repetition.\n"
            "Score 2: Output has significant padding and redundancy.\n"
            "Score 3: Output is reasonably concise with some unnecessary content.\n"
            "Score 4: Output is concise with minimal unnecessary content.\n"
            "Score 5: Output is perfectly concise — every sentence adds value."
        ),
    },
    "correctness": {
        "name": "Correctness",
        "description": "Whether the output is factually and semantically accurate.",
        "rubric": (
            "Score 1: Output contains major factual errors.\n"
            "Score 2: Output has several inaccuracies.\n"
            "Score 3: Output is mostly correct with minor errors.\n"
            "Score 4: Output is accurate with at most one trivial error.\n"
            "Score 5: Output is completely accurate and error-free."
        ),
    },
    "instruction_following": {
        "name": "Instruction Following",
        "description": "Whether the output follows the specific format, constraints, and instructions given.",
        "rubric": (
            "Score 1: Output ignores most instructions and constraints.\n"
            "Score 2: Output follows some instructions but misses key constraints.\n"
            "Score 3: Output follows most instructions with minor deviations.\n"
            "Score 4: Output closely follows instructions with trivial deviations.\n"
            "Score 5: Output perfectly follows all instructions and constraints."
        ),
    },
}

# Map task-defined metric labels to standard criteria
TASK_METRIC_MAP = {
    "conciseness": "conciseness",
    "coverage": "completeness",
    "coherence": "coherence",
    "faithfulness": "faithfulness",
    "accuracy": "correctness",
    "confidence": "correctness",
    "explanations": "helpfulness",
    "relevance": "relevance",
    "recency": "relevance",
    "sources": "faithfulness",
    "completeness": "completeness",
    "precision": "correctness",
    "recall": "completeness",
    "format": "instruction_following",
    "fluency": "coherence",
    "adequacy": "faithfulness",
    "terminology": "correctness",
    "creativity": "helpfulness",
    "tone": "instruction_following",
    "structure": "coherence",
    "meaning": "faithfulness",
    "style shift": "instruction_following",
    "readability": "coherence",
    "depth": "completeness",
    "objectivity": "faithfulness",
    "actionable": "helpfulness",
}


def get_criteria_list():
    """Return all available criteria for the frontend."""
    return [
        {"id": cid, "name": c["name"], "description": c["description"]}
        for cid, c in CRITERIA.items()
    ]


def resolve_criteria(criteria_ids: list[str]) -> list[dict]:
    """Resolve criteria IDs to full criteria objects. Raises ValueError for unknown IDs."""
    resolved = []
    for cid in criteria_ids:
        if cid in CRITERIA:
            resolved.append({"id": cid, **CRITERIA[cid]})
        else:
            # Try mapping from task metric label
            mapped = TASK_METRIC_MAP.get(cid.lower())
            if mapped and mapped in CRITERIA:
                resolved.append({"id": mapped, **CRITERIA[mapped]})
            else:
                raise ValueError(f"Unknown criterion: {cid}")
    # Deduplicate by id
    seen = set()
    unique = []
    for c in resolved:
        if c["id"] not in seen:
            seen.add(c["id"])
            unique.append(c)
    return unique


def _build_judge_prompt(criterion: dict, input_text: str, output_text: str) -> str:
    """Build the G-Eval style judge prompt for a single criterion."""
    return (
        "You are an expert evaluator. Score the following AI response on the criterion below.\n\n"
        f"## Criterion: {criterion['name']}\n"
        f"{criterion['description']}\n\n"
        f"## Rubric\n{criterion['rubric']}\n\n"
        f"## User Input\n{input_text}\n\n"
        f"## AI Response\n{output_text}\n\n"
        "## Instructions\n"
        "1. Analyze the response against the criterion and rubric.\n"
        "2. Provide brief reasoning (2-3 sentences).\n"
        "3. Output your evaluation as JSON with exactly these fields:\n"
        '   {"score": <1-5>, "reasoning": "<your reasoning>"}\n\n'
        "Output ONLY the JSON object, nothing else."
    )


def _parse_judge_response(text: str) -> dict:
    """Parse the judge LLM's response into score + reasoning."""
    # Try to extract JSON from the response
    # Handle cases where the LLM wraps JSON in markdown code blocks
    cleaned = text.strip()
    if "```" in cleaned:
        match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1).strip()

    try:
        data = json.loads(cleaned)
        score = int(data.get("score", 0))
        if score < 1 or score > 5:
            score = max(1, min(5, score))
        return {
            "score": score,
            "reasoning": str(data.get("reasoning", "")),
        }
    except (json.JSONDecodeError, ValueError, TypeError):
        # Fallback: try to find a score number in the text
        match = re.search(r"(?:score|rating)\s*[:\s]*(\d)", text, re.IGNORECASE)
        if match:
            score = max(1, min(5, int(match.group(1))))
            return {"score": score, "reasoning": text.strip()[:200]}
        return {"score": 0, "reasoning": "Failed to parse judge response"}


async def evaluate_single(
    input_text: str,
    output_text: str,
    criterion: dict,
    judge_provider: str,
    judge_model: str,
    judge_api_key: Optional[str] = None,
) -> dict:
    """Evaluate a single output against a single criterion using the judge LLM."""
    provider = get_provider(judge_provider)
    if not provider:
        return {"criterion": criterion["id"], "score": 0, "reasoning": "Unknown judge provider", "error": "Unknown judge provider"}

    litellm_model = to_litellm_model(judge_provider, judge_model)
    prompt = _build_judge_prompt(criterion, input_text, output_text)

    kwargs = {
        "model": litellm_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 256,
        "temperature": 0.0,
    }
    if judge_api_key:
        kwargs["api_key"] = judge_api_key
    if judge_provider == "ollama":
        import os
        kwargs["api_base"] = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    try:
        response = await litellm.acompletion(**kwargs)
        result = _parse_judge_response(response.choices[0].message.content)
        return {
            "criterion": criterion["id"],
            "criterion_name": criterion["name"],
            **result,
            "error": None,
        }
    except Exception as e:
        return {
            "criterion": criterion["id"],
            "criterion_name": criterion["name"],
            "score": 0,
            "reasoning": "",
            "error": str(e),
        }


async def evaluate_output(
    input_text: str,
    output_text: str,
    criteria: list[dict],
    judge_provider: str,
    judge_model: str,
    judge_api_key: Optional[str] = None,
) -> list[dict]:
    """Evaluate a single output against multiple criteria in parallel."""
    tasks = [
        evaluate_single(input_text, output_text, c, judge_provider, judge_model, judge_api_key)
        for c in criteria
    ]
    return await asyncio.gather(*tasks)


async def evaluate_comparison(
    input_text: str,
    outputs: list[dict],
    criteria: list[dict],
    judge_provider: str,
    judge_model: str,
    judge_api_key: Optional[str] = None,
) -> list[dict]:
    """Evaluate multiple outputs against multiple criteria.

    Args:
        input_text: The original user input/prompt.
        outputs: List of {"provider": str, "model": str, "content": str}.
        criteria: List of resolved criteria objects.
        judge_provider: Provider ID for the judge model.
        judge_model: Model ID for the judge.
        judge_api_key: API key for the judge provider.

    Returns:
        List of result dicts, one per output, each containing:
        - provider, model: identifying the evaluated output
        - scores: list of {criterion, criterion_name, score, reasoning, error}
        - average: mean score across criteria (excluding errors)
    """
    all_tasks = []
    task_map = []  # Track which output each task belongs to

    for i, output in enumerate(outputs):
        if not output.get("content"):
            continue
        for criterion in criteria:
            all_tasks.append(
                evaluate_single(
                    input_text, output["content"], criterion,
                    judge_provider, judge_model, judge_api_key,
                )
            )
            task_map.append(i)

    # Run all judge calls in parallel
    all_results = await asyncio.gather(*all_tasks)

    # Group results by output
    grouped = {i: [] for i in range(len(outputs))}
    for idx, result in zip(task_map, all_results):
        grouped[idx].append(result)

    # Build response
    response = []
    for i, output in enumerate(outputs):
        scores = grouped.get(i, [])
        valid_scores = [s["score"] for s in scores if s["score"] > 0]
        avg = round(sum(valid_scores) / len(valid_scores), 2) if valid_scores else None
        response.append({
            "provider": output.get("provider", ""),
            "model": output.get("model", ""),
            "scores": scores,
            "average": avg,
        })

    return response
