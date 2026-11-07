"""Pydantic v2 schemas for quantitative risk and options analytics (NSE/BSE).

Strictly adheres to SYSTEM_SPEC.md:
- Math execution isolated inside apps/server/quant/
- Indian market conventions (INR, 252 NSE trading days, NSE/BSE tickers)
- Strict Pydantic v2 schemas and strict typing
"""

from __future__ import annotations

import math
import re
from typing import List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# Regex for valid NSE/BSE equity tickers and Indian benchmark indices
NSE_BSE_TICKER_REGEX = re.compile(
    r"^(?:[A-Z0-9_\-&^]+(?:\.(?:NS|BO))|NIFTY(?:50|_50|BANK|IT)?|BANKNIFTY|SENSEX|\^NSEI|\^BSESN)$"
)


class NSEPortfolioInput(BaseModel):
    """Input payload for Indian equities portfolio risk analytics."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        str_strip_whitespace=False,
    )

    tickers: List[str] = Field(
        ...,
        min_length=1,
        description="List of NSE/BSE tickers (e.g. ['RELIANCE.NS', 'INFY.NS', 'HDFCBANK.NS']).",
    )
    weights: List[float] = Field(
        ...,
        min_length=1,
        description="Portfolio allocation weights corresponding to each ticker (must sum to 1.0).",
    )
    price_matrix: List[List[float]] = Field(
        ...,
        description="Daily historical price matrix in INR [T days x N tickers], minimum 2 trading days.",
    )
    risk_free_rate: float = Field(
        default=0.068,
        ge=0.0,
        le=1.0,
        description="Annualized risk-free rate (default 0.068 representing 6.8% RBI 10Y G-Sec yield).",
    )
    portfolio_value_inr: float = Field(
        default=1_000_000.0,
        gt=0.0,
        description="Total portfolio valuation in INR (default 10,00,000 INR) for VaR calculation.",
    )

    @field_validator("tickers")
    @classmethod
    def validate_tickers(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Tickers list cannot be empty.")

        # Check unique tickers
        if len(set(v)) != len(v):
            raise ValueError("Portfolio tickers must be unique; duplicate tickers detected.")

        for ticker in v:
            if not isinstance(ticker, str) or not ticker.strip():
                raise ValueError("Ticker symbols must be non-empty strings.")
            if not NSE_BSE_TICKER_REGEX.match(ticker):
                raise ValueError(
                    f"Invalid ticker formatting: '{ticker}'. Tickers must adhere to NSE/BSE conventions "
                    f"(e.g. ending in '.NS' for NSE, '.BO' for BSE, or recognized index symbols like 'NIFTY50')."
                )
        return v

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, v: List[float]) -> List[float]:
        if not v:
            raise ValueError("Weights list cannot be empty.")
        for idx, w in enumerate(v):
            if not isinstance(w, (int, float)) or math.isnan(w) or math.isinf(w):
                raise ValueError(f"Weight at index {idx} must be a valid finite number.")
            if w < 0.0 or w > 1.0:
                raise ValueError(f"Weight at index {idx} ({w}) must be between 0.0 and 1.0 for long-only portfolios.")
        return v

    @field_validator("price_matrix")
    @classmethod
    def validate_price_matrix_structure(cls, v: List[List[float]]) -> List[List[float]]:
        if not v or len(v) < 2:
            raise ValueError("Daily price matrix must contain at least 2 trading days to compute returns.")
        for row_idx, row in enumerate(v):
            if not isinstance(row, list) or len(row) == 0:
                raise ValueError(f"Row {row_idx} of price matrix must be a non-empty list of prices.")
            for col_idx, price in enumerate(row):
                if not isinstance(price, (int, float)) or math.isnan(price) or math.isinf(price) or price <= 0.0:
                    raise ValueError(
                        f"Price at row {row_idx}, column {col_idx} ({price}) must be a strictly positive finite number in INR."
                    )
        return v

    @model_validator(mode="after")
    def validate_consistency(self) -> NSEPortfolioInput:
        num_tickers = len(self.tickers)
        num_weights = len(self.weights)

        if num_weights != num_tickers:
            raise ValueError(
                f"Number of weights ({num_weights}) must match number of tickers ({num_tickers})."
            )

        weight_sum = sum(self.weights)
        if not math.isclose(weight_sum, 1.0, rel_tol=1e-3, abs_tol=1e-3):
            raise ValueError(
                f"Portfolio weights must sum to 1.0 (got {weight_sum:.6f})."
            )

        for row_idx, row in enumerate(self.price_matrix):
            if len(row) != num_tickers:
                raise ValueError(
                    f"Row {row_idx} in price_matrix has {len(row)} items; expected {num_tickers} matching tickers."
                )

        return self


class NSERiskMetricsOutput(BaseModel):
    """Output metrics for Indian equities portfolio risk analytics."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
    )

    annualized_return: float = Field(
        ...,
        description="Annualized portfolio return based on 252 NSE trading days.",
    )
    annualized_volatility: float = Field(
        ...,
        description="Annualized portfolio standard deviation based on 252 NSE trading days.",
    )
    sharpe_ratio: float = Field(
        ...,
        description="Sharpe ratio against RBI G-Sec yield risk-free rate.",
    )
    sortino_ratio: float = Field(
        ...,
        description="Sortino ratio measuring downside risk-adjusted return.",
    )
    max_drawdown: float = Field(
        ...,
        description="Maximum peak-to-trough portfolio drawdown (expressed as non-positive decimal).",
    )
    var_95_inr: float = Field(
        ...,
        description="95% 1-day Value-at-Risk in INR.",
    )


class OptionGreeksInput(BaseModel):
    """Input parameters for Black-Scholes Option Greeks calculation (e.g. Nifty 50 options)."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
    )

    strike_price: float = Field(
        ...,
        gt=0.0,
        description="Option strike price in INR (e.g., 22500 for Nifty 50).",
    )
    spot_price: float = Field(
        ...,
        gt=0.0,
        description="Current underlying spot price in INR (e.g., 22550 for Nifty 50).",
    )
    implied_volatility: float = Field(
        ...,
        ge=0.0,
        description="Annualized implied volatility as a decimal (e.g., 0.15 for 15% IV).",
    )
    time_to_expiry: float = Field(
        ...,
        ge=0.0,
        description="Time to expiration in years (e.g., 7/252 for 7 NSE trading days).",
    )
    risk_free_rate: float = Field(
        default=0.068,
        ge=0.0,
        le=1.0,
        description="Annualized risk-free rate (default 0.068 for RBI G-Sec yield).",
    )
    option_type: Literal["call", "put", "CE", "PE"] = Field(
        default="call",
        description="Option contract type: 'call'/'CE' or 'put'/'PE'.",
    )


class OptionGreeksOutput(BaseModel):
    """Calculated Black-Scholes Option Greeks and theoretical option price."""

    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
    )

    delta: float = Field(
        ...,
        description="Delta: Sensitivity of option price to underlying spot price changes.",
    )
    gamma: float = Field(
        ...,
        description="Gamma: Rate of change of Delta with respect to underlying spot price.",
    )
    vega: float = Field(
        ...,
        description="Vega: Sensitivity of option price to a 1-unit (100%) change in implied volatility.",
    )
    theta: float = Field(
        ...,
        description="Annualized Theta: Time decay rate of option price per year.",
    )
    theta_daily: float = Field(
        ...,
        description="Daily Theta: Time decay rate of option price per NSE trading day (Theta / 252).",
    )
    price: float = Field(
        ...,
        description="Theoretical Black-Scholes option price in INR.",
    )
