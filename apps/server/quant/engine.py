"""Quantitative risk and analytics engine for Indian equities (NSE/BSE).

Strictly adheres to SYSTEM_SPEC.md:
- Rule 1: The LLM must NEVER perform financial arithmetic, Sharpe/Beta calculations,
  or option risk math. All math must execute inside `apps/server/quant/`.
- Rule 2: All financial figures must account for Indian market conventions
  (INR, 252 NSE trading days, NSE/BSE tickers, e.g., RELIANCE.NS, TCS.NS, NIFTY50).
- Rule 3: All tool inputs and outputs must adhere strictly to Pydantic v2 schemas.
- Rule 6: All code must pass strict typing (Python `mypy` compliant).
"""

from __future__ import annotations

import math
from typing import Any, Dict, Union
import numpy as np
import scipy.stats as stats  # type: ignore

try:
    import pandas as pd  # type: ignore
except ImportError:
    pd = None  # type: ignore

from apps.server.quant.schemas import (
    NSEPortfolioInput,
    NSERiskMetricsOutput,
    OptionGreeksInput,
    OptionGreeksOutput,
)

# Indian market trading conventions
NSE_TRADING_DAYS: int = 252
DEFAULT_RBI_GSEC_RATE: float = 0.068


def calculate_portfolio_risk_metrics(input_data: NSEPortfolioInput) -> NSERiskMetricsOutput:
    """Calculate vectorized portfolio risk and performance metrics for Indian equities.

    Metrics calculated:
    - Annualized Return: Compound/arithmetic annualized return using 252 NSE trading days.
    - Annualized Volatility: Sample standard deviation annualized using sqrt(252).
    - Sharpe Ratio: Excess return over RBI 10Y G-Sec yield per unit of total risk.
    - Sortino Ratio: Excess return over RBI 10Y G-Sec yield per unit of downside risk.
    - Max Drawdown: Maximum peak-to-trough decline over the period.
    - 95% VaR (INR): 1-day historical Value-at-Risk scaled to the INR portfolio value.

    Gracefully handles edge cases such as zero-volatility matrices (constant prices)
    without division-by-zero errors.
    """
    # Convert price matrix to numpy array [T days x N tickers]
    prices = np.asarray(input_data.price_matrix, dtype=np.float64)

    # Calculate daily percentage returns: (P_t - P_{t-1}) / P_{t-1}
    # If Pandas is available, use DataFrame pct_change for structured verification
    if pd is not None:
        price_df = pd.DataFrame(data=prices, columns=input_data.tickers)
        daily_returns_matrix = price_df.pct_change().dropna().to_numpy(dtype=np.float64)
    else:
        daily_returns_matrix = (prices[1:] - prices[:-1]) / prices[:-1]

    weights = np.asarray(input_data.weights, dtype=np.float64)

    # Vectorized portfolio daily returns: R_p,t = sum(w_i * R_i,t)
    port_daily_returns = np.dot(daily_returns_matrix, weights)
    num_returns = len(port_daily_returns)

    # Mean daily return and annualized return
    mean_daily_return = float(np.mean(port_daily_returns))
    annualized_return = float(mean_daily_return * NSE_TRADING_DAYS)

    # Sample daily volatility and annualized volatility
    if num_returns > 1:
        daily_volatility = float(np.std(port_daily_returns, ddof=1))
    else:
        daily_volatility = 0.0

    annualized_volatility = float(daily_volatility * np.sqrt(NSE_TRADING_DAYS))

    # Sharpe Ratio (Edge case: zero or near-zero volatility)
    rf = float(input_data.risk_free_rate)
    if annualized_volatility <= 1e-12 or math.isclose(annualized_volatility, 0.0, abs_tol=1e-12):
        if annualized_return < 0.0:
            sharpe_ratio = float((annualized_return - rf) / max(annualized_volatility, 1e-6))
        else:
            sharpe_ratio = 0.0
    else:
        sharpe_ratio = float((annualized_return - rf) / annualized_volatility)

    # Sortino Ratio (Downside deviation relative to daily risk-free rate)
    rf_daily = rf / NSE_TRADING_DAYS
    downside_diff = np.minimum(port_daily_returns - rf_daily, 0.0)
    downside_variance = float(np.mean(downside_diff**2))
    downside_volatility = float(np.sqrt(downside_variance) * np.sqrt(NSE_TRADING_DAYS))

    if (
        annualized_volatility <= 1e-12
        or math.isclose(annualized_volatility, 0.0, abs_tol=1e-12)
        or downside_volatility <= 1e-12
        or math.isclose(downside_volatility, 0.0, abs_tol=1e-12)
    ):
        if annualized_return < 0.0 and downside_volatility > 1e-12:
            sortino_ratio = float((annualized_return - rf) / downside_volatility)
        else:
            sortino_ratio = 0.0
    else:
        sortino_ratio = float((annualized_return - rf) / downside_volatility)

    # Maximum Drawdown: Peak-to-trough decline using cumulative portfolio wealth index
    wealth_index = np.cumprod(1.0 + port_daily_returns)
    wealth_index = np.insert(wealth_index, 0, 1.0)  # Start at base wealth 1.0
    running_max = np.maximum.accumulate(wealth_index)
    drawdowns = (wealth_index - running_max) / running_max
    max_drawdown = float(np.min(drawdowns))

    # 95% Historical Value-at-Risk (VaR in INR) over 1-day horizon
    # 5th percentile of daily returns
    percentile_5 = float(np.percentile(port_daily_returns, 5))
    if percentile_5 < 0.0:
        var_95_inr = float(abs(percentile_5) * input_data.portfolio_value_inr)
    else:
        var_95_inr = 0.0

    return NSERiskMetricsOutput(
        annualized_return=annualized_return,
        annualized_volatility=annualized_volatility,
        sharpe_ratio=sharpe_ratio,
        sortino_ratio=sortino_ratio,
        max_drawdown=max_drawdown,
        var_95_inr=var_95_inr,
    )


def calculate_option_greeks(input_data: OptionGreeksInput) -> OptionGreeksOutput:
    """Calculate Black-Scholes theoretical price and Greeks for NSE index/equity options.

    Greeks calculated:
    - Delta: Sensitivity to spot price
    - Gamma: Sensitivity of Delta to spot price
    - Vega: Sensitivity to 1-unit (100%) change in implied volatility
    - Theta: Annualized time decay
    - Theta Daily: Time decay per NSE trading day (Theta / 252)
    - Price: Theoretical Black-Scholes option price in INR

    Robustly handles edge cases:
    - Zero time to expiry (T = 0)
    - Zero implied volatility (IV = 0)
    """
    s = float(input_data.spot_price)
    k = float(input_data.strike_price)
    t = float(input_data.time_to_expiry)
    iv = float(input_data.implied_volatility)
    r = float(input_data.risk_free_rate)
    is_call = input_data.option_type.upper() in ("CALL", "CE")

    # Edge Case 1: At expiry (T <= 0)
    if t <= 0.0 or math.isclose(t, 0.0, abs_tol=1e-12):
        if is_call:
            intrinsic = max(s - k, 0.0)
            if s > k:
                delta = 1.0
            elif math.isclose(s, k, abs_tol=1e-7):
                delta = 0.5
            else:
                delta = 0.0
        else:
            intrinsic = max(k - s, 0.0)
            if s < k:
                delta = -1.0
            elif math.isclose(s, k, abs_tol=1e-7):
                delta = -0.5
            else:
                delta = 0.0

        return OptionGreeksOutput(
            delta=delta,
            gamma=0.0,
            vega=0.0,
            theta=0.0,
            theta_daily=0.0,
            price=intrinsic,
        )

    # Edge Case 2: Zero Volatility (IV <= 0)
    if iv <= 0.0 or math.isclose(iv, 0.0, abs_tol=1e-12):
        discount = math.exp(-r * t)
        forward_k = k * discount
        if is_call:
            price = max(s - forward_k, 0.0)
            delta = 1.0 if s > forward_k else (0.5 if math.isclose(s, forward_k, abs_tol=1e-7) else 0.0)
            theta = -r * forward_k if s > forward_k else 0.0
        else:
            price = max(forward_k - s, 0.0)
            delta = -1.0 if s < forward_k else (-0.5 if math.isclose(s, forward_k, abs_tol=1e-7) else 0.0)
            theta = r * forward_k if s < forward_k else 0.0

        return OptionGreeksOutput(
            delta=delta,
            gamma=0.0,
            vega=0.0,
            theta=theta,
            theta_daily=theta / NSE_TRADING_DAYS,
            price=price,
        )

    # Standard Black-Scholes formulation
    sqrt_t = math.sqrt(t)
    d1 = (math.log(s / k) + (r + 0.5 * iv * iv) * t) / (iv * sqrt_t)
    d2 = d1 - iv * sqrt_t

    pdf_d1 = float(stats.norm.pdf(d1))
    cdf_d1 = float(stats.norm.cdf(d1))
    cdf_d2 = float(stats.norm.cdf(d2))
    cdf_neg_d1 = float(stats.norm.cdf(-d1))
    cdf_neg_d2 = float(stats.norm.cdf(-d2))
    discount = math.exp(-r * t)

    gamma = float(pdf_d1 / (s * iv * sqrt_t))
    vega = float(s * sqrt_t * pdf_d1)

    if is_call:
        price = float(s * cdf_d1 - k * discount * cdf_d2)
        delta = float(cdf_d1)
        theta = float(-(s * pdf_d1 * iv) / (2.0 * sqrt_t) - r * k * discount * cdf_d2)
    else:
        price = float(k * discount * cdf_neg_d2 - s * cdf_neg_d1)
        delta = float(cdf_d1 - 1.0)
        theta = float(-(s * pdf_d1 * iv) / (2.0 * sqrt_t) + r * k * discount * cdf_neg_d2)

    theta_daily = float(theta / NSE_TRADING_DAYS)

    return OptionGreeksOutput(
        delta=delta,
        gamma=gamma,
        vega=vega,
        theta=theta,
        theta_daily=theta_daily,
        price=price,
    )


def calculate_option_greeks_vectorized(
    spot_prices: Union[float, np.ndarray],
    strike_prices: Union[float, np.ndarray],
    times_to_expiry: Union[float, np.ndarray],
    implied_vols: Union[float, np.ndarray],
    risk_free_rate: float = DEFAULT_RBI_GSEC_RATE,
    option_type: str = "call",
) -> Dict[str, np.ndarray]:
    """Fully vectorized Black-Scholes Greeks calculator over NumPy arrays.

    Ideal for calculating entire Nifty 50 option chains across multiple strikes
    and expiration dates simultaneously.
    """
    s = np.asarray(spot_prices, dtype=np.float64)
    k = np.asarray(strike_prices, dtype=np.float64)
    t = np.asarray(times_to_expiry, dtype=np.float64)
    iv = np.asarray(implied_vols, dtype=np.float64)
    r = float(risk_free_rate)
    is_call = option_type.upper() in ("CALL", "CE")

    # Safe divisions to prevent div-by-zero warnings in vectorization
    safe_t = np.where(t <= 1e-12, 1e-12, t)
    safe_iv = np.where(iv <= 1e-12, 1e-12, iv)
    sqrt_t = np.sqrt(safe_t)

    d1 = (np.log(s / k) + (r + 0.5 * safe_iv**2) * safe_t) / (safe_iv * sqrt_t)
    d2 = d1 - safe_iv * sqrt_t

    pdf_d1 = stats.norm.pdf(d1)
    cdf_d1 = stats.norm.cdf(d1)
    cdf_d2 = stats.norm.cdf(d2)
    cdf_neg_d1 = stats.norm.cdf(-d1)
    cdf_neg_d2 = stats.norm.cdf(-d2)
    discount = np.exp(-r * safe_t)

    gamma = pdf_d1 / (s * safe_iv * sqrt_t)
    vega = s * sqrt_t * pdf_d1

    if is_call:
        price = s * cdf_d1 - k * discount * cdf_d2
        delta = cdf_d1
        theta = -(s * pdf_d1 * safe_iv) / (2.0 * sqrt_t) - r * k * discount * cdf_d2
    else:
        price = k * discount * cdf_neg_d2 - s * cdf_neg_d1
        delta = cdf_d1 - 1.0
        theta = -(s * pdf_d1 * safe_iv) / (2.0 * sqrt_t) + r * k * discount * cdf_neg_d2

    # Zero out Greeks for expired options
    zero_mask = (t <= 1e-12) | (iv <= 1e-12)
    gamma = np.where(zero_mask, 0.0, gamma)
    vega = np.where(zero_mask, 0.0, vega)

    theta_daily = theta / NSE_TRADING_DAYS

    return {
        "price": price,
        "delta": delta,
        "gamma": gamma,
        "vega": vega,
        "theta": theta,
        "theta_daily": theta_daily,
    }
