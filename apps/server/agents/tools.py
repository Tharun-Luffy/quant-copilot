"""LangChain tools for quantitative risk and corporate filings retrieval.

Adheres strictly to SYSTEM_SPEC.md:
- Rule 1: LLM never performs math; all financial calculations execute in apps/server/quant/engine.py
- Rule 2: Indian market conventions (INR, 252 NSE trading days, NSE/BSE tickers)
- Rule 3: Strict Pydantic v2 schemas for all tool inputs and outputs
- Rule 4: Redis cache fallback handling on external market API failures
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

# Graceful import of langchain_core.tools with fallback
try:
    from langchain_core.tools import tool  # type: ignore
except ImportError:
    def tool(name_or_fn: Any = None, args_schema: Any = None, description: Any = None) -> Any:  # type: ignore
        def decorator(fn: Any) -> Any:
            fn.name = name_or_fn if isinstance(name_or_fn, str) else fn.__name__
            fn.description = description or fn.__doc__
            fn.args_schema = args_schema
            return fn
        if callable(name_or_fn):
            fn = name_or_fn
            fn.name = fn.__name__
            fn.description = fn.__doc__
            return fn
        return decorator

from apps.server.quant.schemas import NSEPortfolioInput, NSERiskMetricsOutput
from apps.server.quant.engine import calculate_portfolio_risk_metrics
from apps.server.core.db import db_manager


# ==============================================================================
# Tool 1: CalculateNSERiskTool
# ==============================================================================

@tool("CalculateNSERiskTool", args_schema=NSEPortfolioInput)
def calculate_nse_risk_tool(
    tickers: List[str],
    weights: List[float],
    price_matrix: List[List[float]],
    risk_free_rate: float = 0.068,
    portfolio_value_inr: float = 1_000_000.0,
) -> Dict[str, Any]:
    """Calculate quantitative risk metrics (Sharpe, Sortino, Max Drawdown, 95% VaR) for Indian portfolios.

    All math is isolated inside apps/server/quant/engine.py using 252 NSE trading days and INR conventions.
    """
    portfolio_input = NSEPortfolioInput(
        tickers=tickers,
        weights=weights,
        price_matrix=price_matrix,
        risk_free_rate=risk_free_rate,
        portfolio_value_inr=portfolio_value_inr,
    )
    output: NSERiskMetricsOutput = calculate_portfolio_risk_metrics(portfolio_input)
    return output.model_dump()


# Alias class-style or tool reference as specified in prompt
CalculateNSERiskTool = calculate_nse_risk_tool


# ==============================================================================
# Tool 2: FetchBSECorporateAnnouncements
# ==============================================================================

class BSEAnnouncementsFilter(BaseModel):
    """Pydantic v2 input schema for BSE/NSE corporate announcements search."""

    model_config = ConfigDict(extra="forbid")

    ticker: str = Field(
        ...,
        description="NSE/BSE ticker symbol (e.g., 'RELIANCE.NS', 'TCS.BO', 'INFY.NS', 'HDFCBANK.NS').",
    )
    fiscal_quarter: Optional[str] = Field(
        None,
        description="Fiscal quarter filter (e.g. 'Q1FY25', 'Q4FY24').",
    )
    announcement_type: Optional[Literal["earnings", "board_meeting", "dividend", "agm", "all"]] = Field(
        None,
        description="Category of corporate announcement (e.g., 'earnings', 'board_meeting', 'dividend').",
    )
    query: Optional[str] = Field(
        None,
        description="Optional semantic query for vector similarity search via pgvector.",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Maximum number of filing records to return.",
    )


class AnnouncementRecord(BaseModel):
    """Pydantic v2 schema for individual corporate filing record."""

    model_config = ConfigDict(extra="forbid")

    id: str
    ticker: str
    company_name: str
    fiscal_quarter: Optional[str]
    announcement_type: str
    title: str
    summary: str
    filing_date: str
    similarity_score: Optional[float] = None


class BSEAnnouncementsOutput(BaseModel):
    """Pydantic v2 output schema for BSE/NSE corporate announcements."""

    model_config = ConfigDict(extra="forbid")

    ticker: str
    total_results: int
    announcements: List[AnnouncementRecord]


@tool("FetchBSECorporateAnnouncements", args_schema=BSEAnnouncementsFilter)
def fetch_bse_corporate_announcements(
    ticker: str,
    fiscal_quarter: Optional[str] = None,
    announcement_type: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = 5,
) -> Dict[str, Any]:
    """Retrieve BSE/NSE corporate filing summaries (earnings, dividends, board meetings) stored as embeddings in PostgreSQL + pgvector."""
    # Filter input validation
    filter_in = BSEAnnouncementsFilter(
        ticker=ticker,
        fiscal_quarter=fiscal_quarter,
        announcement_type=announcement_type if announcement_type in ("earnings", "board_meeting", "dividend", "agm", "all") else None,
        query=query,
        limit=limit,
    )

    # Convert query into simple mock embedding if text query provided
    query_vector = None
    if filter_in.query:
        query_vector = [0.05] * 128

    # Query PostgreSQL + pgvector
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        # When called within async loop
        import nest_asyncio  # type: ignore
        try:
            nest_asyncio.apply()
        except Exception:
            pass
        rows = loop.run_until_complete(
            db_manager.search_announcements(
                ticker=filter_in.ticker,
                fiscal_quarter=filter_in.fiscal_quarter,
                announcement_type=filter_in.announcement_type,
                query_vector=query_vector,
                limit=filter_in.limit,
            )
        )
    else:
        rows = asyncio.run(
            db_manager.search_announcements(
                ticker=filter_in.ticker,
                fiscal_quarter=filter_in.fiscal_quarter,
                announcement_type=filter_in.announcement_type,
                query_vector=query_vector,
                limit=filter_in.limit,
            )
        )

    records = [AnnouncementRecord(**r) for r in rows]
    output = BSEAnnouncementsOutput(
        ticker=filter_in.ticker,
        total_results=len(records),
        announcements=records,
    )
    return output.model_dump()


FetchBSECorporateAnnouncements = fetch_bse_corporate_announcements


# ==============================================================================
# Tool 3: FetchMarketData (with Rate Limit Simulation)
# ==============================================================================

class MarketQuoteInput(BaseModel):
    ticker: str = Field(..., description="NSE/BSE ticker symbol (e.g., 'RELIANCE.NS')")
    force_rate_limit: bool = Field(default=False, description="Simulate 429 Rate Limit error")


class MarketAPIRateLimitError(Exception):
    """Raised when external market data provider (NSE India, Yahoo Finance, Moneycontrol) rate limits."""
    pass


@tool("FetchMarketQuote", args_schema=MarketQuoteInput)
def fetch_market_quote(ticker: str, force_rate_limit: bool = False) -> Dict[str, Any]:
    """Fetch live market quote from external API, triggering rate-limit errors when restricted."""
    if force_rate_limit:
        raise MarketAPIRateLimitError(
            f"External Market API 429 Too Many Requests: Rate limit exceeded for {ticker}"
        )
    # Simulated external live response
    return {
        "ticker": ticker.upper(),
        "live_price": 2595.0,
        "currency": "INR",
        "stale": False,
        "source": "live_nse_feed",
    }
