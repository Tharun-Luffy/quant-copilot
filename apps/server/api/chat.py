"""FastAPI Server-Sent Events (SSE) chat endpoint streaming reasoning tokens and tool payloads."""

from __future__ import annotations

import json
from typing import AsyncGenerator, Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from apps.server.quant.schemas import NSEPortfolioInput
from apps.server.agents.state import AgentState
from apps.server.agents.graph import execute_agent_cycle

router = APIRouter(prefix="/api", tags=["Chat"])


class ChatRequest(BaseModel):
    """Payload for conversational quant analysis."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, description="User prompt or analysis request.")
    ticker: Optional[str] = Field(None, description="NSE/BSE ticker (e.g. 'RELIANCE.NS', 'TCS.NS').")
    thread_id: Optional[str] = Field("default_thread", description="Stateful conversation thread ID.")
    portfolio: Optional[NSEPortfolioInput] = Field(None, description="Optional Indian equity portfolio payload.")
    force_rate_limit: bool = Field(False, description="Force external API rate limit (HTTP 429) to trigger Redis fallback.")


def format_sse(event: str, data: dict) -> str:
    """Format dictionary payload into SSE wire format."""
    payload = json.dumps(data)
    return f"event: {event}\ndata: {payload}\n\n"


async def sse_event_stream(chat_req: ChatRequest) -> AsyncGenerator[str, None]:
    """Generate real-time SSE stream of reasoning tokens and tool execution payloads."""
    initial_state: AgentState = {
        "messages": [{"role": "user", "content": chat_req.message}],
        "ticker": chat_req.ticker,
        "rate_limit_encountered": chat_req.force_rate_limit,
        "is_stale": False,
        "tool_calls": [],
        "tool_outputs": [],
    }

    # If portfolio is explicitly provided in request, inject tool call directly
    if chat_req.portfolio:
        initial_state["tool_calls"] = [{
            "tool": "CalculateNSERiskTool",
            "input": chat_req.portfolio.model_dump(),
        }]

    try:
        async for event in execute_agent_cycle(initial_state):
            yield format_sse(event["event"], event["data"])
    except Exception as exc:
        yield format_sse("error", {"error": str(exc)})


@router.post("/chat")
async def chat_endpoint(request: ChatRequest) -> StreamingResponse:
    """FastAPI POST endpoint returning Server-Sent Events (SSE).

    Streams real-time events:
    - 'tool_start': structured tool payload when tool execution begins
    - 'tool_end': structured tool payload on completion
    - 'fallback': triggered when external APIs rate limit, serving cached Redis data (stale: true)
    - 'token': real-time reasoning tokens
    - 'done': stream completion confirmation
    """
    return StreamingResponse(
        sse_event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
