# ARCHITECTURAL RULES (NSE/BSE Quantitative Copilot)
1. The LLM must NEVER perform financial arithmetic, Sharpe/Beta calculations, or option risk math. All math must execute inside `apps/server/quant/`.
2. All financial figures must account for Indian market conventions (INR, 252 NSE trading days, NSE/BSE tickers, e.g., RELIANCE.NS, TCS.NS, NIFTY50).
3. All tool inputs and outputs must adhere strictly to Pydantic v2 schemas.
4. If an external API (e.g., Yahoo Finance NSE, NSE India, or Moneycontrol scraper) fails or rate-limits, LangGraph must trigger a fallback node serving cached Redis data with a `stale: true` flag.
5. Portfolio rebalancing and order placement require an explicit Human-in-the-Loop (HITL) approval step before state mutation.
6. All code must pass strict typing (TypeScript `strict: true`, Python `mypy` compliant).