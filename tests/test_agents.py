"""Unit tests for LangGraph agent graph, tools, Redis fallback, and FastAPI SSE endpoint."""

import asyncio
import json
import pytest
from pydantic import ValidationError

from apps.server.agents.tools import (
    CalculateNSERiskTool,
    FetchBSECorporateAnnouncements,
    fetch_market_quote,
    MarketAPIRateLimitError,
    BSEAnnouncementsFilter,
)
from apps.server.agents.state import AgentState
from apps.server.agents.graph import (
    agent_node,
    tools_node,
    fallback_node,
    route_agent_output,
    route_tools_output,
    execute_agent_cycle,
)
from apps.server.api.chat import ChatRequest, sse_event_stream, format_sse


# ==============================================================================
# 1. Tools Tests
# ==============================================================================

class TestAgentTools:
    """Tests for CalculateNSERiskTool and FetchBSECorporateAnnouncements."""

    def test_calculate_nse_risk_tool(self) -> None:
        """Test CalculateNSERiskTool wraps quant engine with strict Pydantic v2 schemas."""
        payload = {
            "tickers": ["RELIANCE.NS", "INFY.NS"],
            "weights": [0.6, 0.4],
            "price_matrix": [
                [2500.0, 1500.0],
                [2520.0, 1510.0],
                [2540.0, 1520.0],
            ],
            "risk_free_rate": 0.068,
            "portfolio_value_inr": 1_000_000.0,
        }
        res = CalculateNSERiskTool(**payload)
        assert isinstance(res, dict)
        assert "annualized_return" in res
        assert "annualized_volatility" in res
        assert "sharpe_ratio" in res
        assert "sortino_ratio" in res
        assert "max_drawdown" in res
        assert "var_95_inr" in res

    def test_fetch_bse_corporate_announcements_metadata_filter(self) -> None:
        """Test FetchBSECorporateAnnouncements with ticker, fiscal quarter, and type filters."""
        # Query earnings for Reliance Q1FY25
        res = FetchBSECorporateAnnouncements(
            ticker="RELIANCE.NS",
            fiscal_quarter="Q1FY25",
            announcement_type="earnings",
            limit=5,
        )
        assert isinstance(res, dict)
        assert res["ticker"] == "RELIANCE.NS"
        assert res["total_results"] >= 1
        for ann in res["announcements"]:
            assert ann["ticker"] == "RELIANCE.NS"
            assert ann["fiscal_quarter"] == "Q1FY25"
            assert ann["announcement_type"] == "earnings"
            assert "similarity_score" in ann

    def test_fetch_bse_corporate_announcements_dividend(self) -> None:
        """Test dividend announcement retrieval for TCS."""
        res = FetchBSECorporateAnnouncements(
            ticker="TCS.BO",
            announcement_type="dividend",
            limit=2,
        )
        assert res["total_results"] >= 1
        assert res["announcements"][0]["announcement_type"] == "dividend"

    def test_fetch_market_quote_success(self) -> None:
        """Test live quote retrieval when external API succeeds."""
        res = fetch_market_quote("RELIANCE.NS", force_rate_limit=False)
        assert res["ticker"] == "RELIANCE.NS"
        assert res["stale"] is False

    def test_fetch_market_quote_rate_limit(self) -> None:
        """Test external API rate limit raises MarketAPIRateLimitError."""
        with pytest.raises(MarketAPIRateLimitError):
            fetch_market_quote("RELIANCE.NS", force_rate_limit=True)


# ==============================================================================
# 2. Cyclic LangGraph Nodes & Fallback Routing Tests
# ==============================================================================

class TestLangGraphCyclicFlow:
    """Tests for LangGraph cyclic routing, fallback node, and Redis caching (Rule 4)."""

    @pytest.mark.asyncio
    async def test_agent_node_decision(self) -> None:
        """Test agent node generates tool calls for portfolio risk request."""
        state: AgentState = {
            "messages": [{"role": "user", "content": "Analyze risk metrics for my portfolio"}],
        }
        next_state = await agent_node(state)
        assert len(next_state.get("tool_calls", [])) > 0
        assert next_state["tool_calls"][0]["tool"] == "CalculateNSERiskTool"
        assert route_agent_output(next_state) == "tools_node"

    @pytest.mark.asyncio
    async def test_tools_node_normal_execution(self) -> None:
        """Test tools_node executes tools cleanly when no rate limits occur."""
        state: AgentState = {
            "tool_calls": [{
                "tool": "FetchMarketQuote",
                "input": {"ticker": "RELIANCE.NS", "force_rate_limit": False},
            }],
            "tool_outputs": [],
        }
        next_state = await tools_node(state)
        assert len(next_state["tool_outputs"]) == 1
        assert next_state.get("is_stale") is False
        assert route_tools_output(next_state) == "agent_node"

    @pytest.mark.asyncio
    async def test_fallback_node_triggered_on_rate_limit(self) -> None:
        """Test Rule 4: Rate limit routes to fallback_node returning cached Redis data with stale: true."""
        state: AgentState = {
            "ticker": "RELIANCE.NS",
            "tool_calls": [{
                "tool": "FetchMarketQuote",
                "input": {"ticker": "RELIANCE.NS", "force_rate_limit": True},
            }],
            "tool_outputs": [],
        }
        # Step 1: tools_node encounters rate limit
        state_after_tools = await tools_node(state)
        assert state_after_tools["rate_limit_encountered"] is True
        assert route_tools_output(state_after_tools) == "fallback_node"

        # Step 2: fallback_node executes
        state_after_fallback = await fallback_node(state_after_tools)
        assert state_after_fallback["is_stale"] is True
        assert state_after_fallback["stale_timestamp"] is not None
        assert state_after_fallback["market_data"] is not None
        assert state_after_fallback["market_data"]["ticker"] == "RELIANCE.NS"
        assert state_after_fallback["market_data"]["last_price"] > 0

        # Step 3: Cycles back to agent_node
        state_final = await agent_node(state_after_fallback)
        assert "final_response" in state_final
        assert "stale: true" in state_final["final_response"].lower() or "cached" in state_final["final_response"].lower()


# ==============================================================================
# 3. Server-Sent Events (SSE) Streaming Tests
# ==============================================================================

class TestSSEStreaming:
    """Tests for Server-Sent Events format and real-time event generator."""

    def test_format_sse(self) -> None:
        """Verify standard SSE wire format: event: ...\ndata: ...\n\n."""
        sse_str = format_sse("token", {"content": "Hello"})
        assert sse_str.startswith("event: token\n")
        assert 'data: {"content": "Hello"}\n\n' in sse_str

    @pytest.mark.asyncio
    async def test_sse_event_stream_live_run(self) -> None:
        """Test sse_event_stream yields node_start, tool_end, tokens, and done events."""
        req = ChatRequest(message="Calculate risk metrics for my Indian equities portfolio")
        events = []
        async for chunk in sse_event_stream(req):
            events.append(chunk)

        full_stream = "".join(events)
        assert "event: node_start" in full_stream
        assert "event: tool_start" in full_stream
        assert "event: tool_end" in full_stream
        assert "event: token" in full_stream
        assert "event: done" in full_stream

    @pytest.mark.asyncio
    async def test_sse_event_stream_with_rate_limit_fallback(self) -> None:
        """Test sse_event_stream triggers fallback event when rate limit is active."""
        req = ChatRequest(
            message="Check price of RELIANCE.NS with 429 rate limit",
            force_rate_limit=True,
            ticker="RELIANCE.NS",
        )
        events = []
        async for chunk in sse_event_stream(req):
            events.append(chunk)

        full_stream = "".join(events)
        assert "event: fallback" in full_stream
        assert '"stale": true' in full_stream.lower()

    @pytest.mark.asyncio
    async def test_sse_event_stream_with_hitl_rebalance(self) -> None:
        """Test Rule 5: sse_event_stream emits rebalance_proposal event for sector rebalancing."""
        req = ChatRequest(message="Propose portfolio rebalance: Trim 10% IT, Allocate to Private Banking")
        events = []
        async for chunk in sse_event_stream(req):
            events.append(chunk)

        full_stream = "".join(events)
        assert "event: rebalance_proposal" in full_stream
        assert "Trim 10% IT" in full_stream

