"""FastAPI server - serves the API and static frontend."""

import asyncio
import os
import time
from pathlib import Path
from typing import Optional

import litellm
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .evaluation import evaluate_comparison, get_criteria_list, resolve_criteria
from .providers import get_models, get_provider, get_providers, to_litellm_model

app = FastAPI(title="LLMLab", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"


# ── Pydantic models ──


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    provider: str
    model: str
    messages: list[ChatMessage]
    api_key: Optional[str] = None
    max_tokens: int = 2048
    temperature: Optional[float] = None
    top_p: Optional[float] = None


class CompareModelSpec(BaseModel):
    provider: str
    model: str
    api_key: Optional[str] = None


class CompareRequest(BaseModel):
    models: list[CompareModelSpec]
    messages: list[ChatMessage]
    max_tokens: int = 2048
    temperature: Optional[float] = None
    top_p: Optional[float] = None


class EvalOutputSpec(BaseModel):
    provider: str
    model: str
    content: str


class EvaluateRequest(BaseModel):
    input_text: str
    outputs: list[EvalOutputSpec]
    criteria: list[str]
    judge_provider: str
    judge_model: str
    judge_api_key: Optional[str] = None


# ── API endpoints ──


@app.get("/api/providers")
def list_providers():
    return get_providers()


@app.get("/api/models/{provider_id}")
def list_models(provider_id: str):
    provider = get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Unknown provider")
    return {"models": get_models(provider_id)}


@app.post("/api/chat")
async def chat(req: ChatRequest):
    provider = get_provider(req.provider)
    if not provider:
        raise HTTPException(status_code=404, detail="Unknown provider")

    if provider["needsKey"] and not req.api_key:
        raise HTTPException(status_code=400, detail=f"{provider['name']} requires an API key")

    litellm_model = to_litellm_model(req.provider, req.model)
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Build kwargs for litellm
    kwargs = {
        "model": litellm_model,
        "messages": messages,
        "max_tokens": req.max_tokens,
    }
    if req.api_key:
        kwargs["api_key"] = req.api_key

    # Dynamically check which params this provider supports
    supported = set(litellm.get_supported_openai_params(model=litellm_model) or [])
    if req.temperature is not None and "temperature" in supported:
        kwargs["temperature"] = req.temperature
    if req.top_p is not None and "top_p" in supported:
        kwargs["top_p"] = req.top_p

    # For Ollama, set the API base
    if req.provider == "ollama":
        kwargs["api_base"] = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    try:
        response = await litellm.acompletion(**kwargs)

        # Extract response data
        choice = response.choices[0]
        usage = response.usage

        return {
            "content": choice.message.content,
            "usage": {
                "input_tokens": usage.prompt_tokens,
                "output_tokens": usage.completion_tokens,
            },
            "model": response.model,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _run_one(spec: CompareModelSpec, messages: list[dict], max_tokens: int,
                   temperature: float | None = None, top_p: float | None = None) -> dict:
    """Run a single model completion, returning result or error."""
    provider = get_provider(spec.provider)
    if not provider:
        return {"provider": spec.provider, "model": spec.model, "error": "Unknown provider"}

    if provider["needsKey"] and not spec.api_key:
        return {"provider": spec.provider, "model": spec.model, "error": f"{provider['name']} requires an API key"}

    litellm_model = to_litellm_model(spec.provider, spec.model)
    kwargs = {"model": litellm_model, "messages": messages, "max_tokens": max_tokens}
    # Dynamically check which params this provider supports
    supported = set(litellm.get_supported_openai_params(model=litellm_model) or [])
    if temperature is not None and "temperature" in supported:
        kwargs["temperature"] = temperature
    if top_p is not None and "top_p" in supported:
        kwargs["top_p"] = top_p
    if spec.api_key:
        kwargs["api_key"] = spec.api_key
    if spec.provider == "ollama":
        kwargs["api_base"] = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    t0 = time.time()
    try:
        response = await litellm.acompletion(**kwargs)
        latency_ms = int((time.time() - t0) * 1000)
        choice = response.choices[0]
        usage = response.usage
        return {
            "provider": spec.provider,
            "model": response.model,
            "content": choice.message.content,
            "usage": {"input_tokens": usage.prompt_tokens, "output_tokens": usage.completion_tokens},
            "latency_ms": latency_ms,
            "error": None,
        }
    except Exception as e:
        latency_ms = int((time.time() - t0) * 1000)
        return {"provider": spec.provider, "model": spec.model, "error": str(e), "latency_ms": latency_ms}


@app.post("/api/chat/compare")
async def compare(req: CompareRequest):
    if len(req.models) < 2 or len(req.models) > 5:
        raise HTTPException(status_code=400, detail="Provide 2-5 models to compare")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    results = await asyncio.gather(
        *[_run_one(spec, messages, req.max_tokens, req.temperature, req.top_p) for spec in req.models]
    )
    return {"results": results}


# ── Evaluation endpoints ──


@app.get("/api/evaluate/criteria")
def list_criteria():
    """Return all available evaluation criteria."""
    return {"criteria": get_criteria_list()}


@app.post("/api/evaluate")
async def evaluate(req: EvaluateRequest):
    """Evaluate model outputs using an LLM judge."""
    if not req.outputs:
        raise HTTPException(status_code=400, detail="No outputs to evaluate")
    if not req.criteria:
        raise HTTPException(status_code=400, detail="No criteria specified")
    if len(req.criteria) > 8:
        raise HTTPException(status_code=400, detail="Maximum 8 criteria per evaluation")

    judge_provider = get_provider(req.judge_provider)
    if not judge_provider:
        raise HTTPException(status_code=404, detail="Unknown judge provider")
    if judge_provider["needsKey"] and not req.judge_api_key:
        raise HTTPException(
            status_code=400,
            detail=f"{judge_provider['name']} requires an API key for the judge model",
        )

    try:
        criteria = resolve_criteria(req.criteria)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    outputs = [{"provider": o.provider, "model": o.model, "content": o.content} for o in req.outputs]

    results = await evaluate_comparison(
        input_text=req.input_text,
        outputs=outputs,
        criteria=criteria,
        judge_provider=req.judge_provider,
        judge_model=req.judge_model,
        judge_api_key=req.judge_api_key,
    )

    return {"results": results}


# ── Static file serving (built frontend) ──


@app.get("/")
async def serve_index():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse(
        {"message": "LLMLab API is running. Frontend not built yet. Run: cd frontend && npm run build"},
        status_code=200,
    )


# Mount static files if the directory has content
if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
