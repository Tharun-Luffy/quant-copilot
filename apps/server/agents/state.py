"""LangGraph state schema for Quant Copilot agent graph."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    """Stateful schema passed across LangGraph nodes."""

    messages: List[Dict[str, Any]]
    ticker: Optional[str]
    market_data: Optional[Dict[str, Any]]
    is_stale: bool
    stale_timestamp: Optional[str]
    rate_limit_encountered: bool
    error: Optional[str]
    tool_calls: List[Dict[str, Any]]
    tool_outputs: List[Dict[str, Any]]
    portfolio: Optional[Dict[str, Any]]
    portfolio_input: Optional[Dict[str, Any]]
    guardrail_triggered: bool
    guardrail_reason: Optional[str]
    hitl_pending: bool
    final_response: Optional[str]
