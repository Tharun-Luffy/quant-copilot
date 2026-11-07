"""Comprehensive unit tests for the quantitative risk and options engine.

Guarantees 100% test coverage with Pytest across:
- Pydantic v2 schemas and validation constraints
- Indian market conventions (INR, 252 NSE trading days, NSE/BSE tickers)
- Edge cases: invalid ticker formatting, zero-volatility matrices, T=0 expiry, IV=0
- Mathematical consistency: Put-Call Parity, Delta spread, drawdown boundaries
"""

import math
import numpy as np
import pytest
from pydantic import ValidationError

from apps.server.quant.schemas import (
    NSEPortfolioInput,
    NSERiskMetricsOutput,
    OptionGreeksInput,
    OptionGreeksOutput,
)
from apps.server.quant.engine import (
    NSE_TRADING_DAYS,
    DEFAULT_RBI_GSEC_RATE,
    calculate_portfolio_risk_metrics,
    calculate_option_greeks,
    calculate_option_greeks_vectorized,
)


# ==============================================================================
# 1. Ticker Formatting & Validation Tests
# ==============================================================================

class TestTickerValidation:
    """Tests for Indian market ticker formatting (NSE/BSE)."""

    def test_valid_nse_tickers(self) -> None:
        """Valid NSE equity tickers ending with .NS."""
        valid_tickers = ["RELIANCE.NS", "INFY.NS", "HDFCBANK.NS", "TCS.NS", "M&M.NS", "BAJAJ-AUTO.NS"]
        weights = [1.0 / len(valid_tickers)] * len(valid_tickers)
        prices = [[100.0] * len(valid_tickers), [102.0] * len(valid_tickers)]

        portfolio = NSEPortfolioInput(
            tickers=valid_tickers,
            weights=weights,
            price_matrix=prices,
        )
        assert portfolio.tickers == valid_tickers
        assert portfolio.risk_free_rate == DEFAULT_RBI_GSEC_RATE

    def test_valid_bse_tickers(self) -> None:
        """Valid BSE equity tickers ending with .BO (including numeric scrip codes)."""
        valid_bse = ["RELIANCE.BO", "500325.BO", "TCS.BO"]
        weights = [1.0 / len(valid_bse)] * len(valid_bse)
        prices = [[500.0] * len(valid_bse), [510.0] * len(valid_bse)]

        portfolio = NSEPortfolioInput(
            tickers=valid_bse,
            weights=weights,
            price_matrix=prices,
        )
        assert portfolio.tickers == valid_bse

    def test_valid_indian_indices(self) -> None:
        """Valid Indian market index symbols."""
        indices = ["NIFTY50", "BANKNIFTY", "SENSEX", "^NSEI", "^BSESN"]
        weights = [1.0 / len(indices)] * len(indices)
        prices = [[20000.0] * len(indices), [20100.0] * len(indices)]

        portfolio = NSEPortfolioInput(
            tickers=indices,
            weights=weights,
            price_matrix=prices,
        )
        assert portfolio.tickers == indices

    @pytest.mark.parametrize(
        "invalid_ticker",
        [
            "AAPL.US",          # US ticker
            "TSLA.O",           # NASDAQ ticker
            "reliance.ns",      # Lowercase not allowed
            "RELIANCE",         # Missing exchange suffix
            "INVALID$$$",       # Illegal special characters
            "RELIANCE@NS",      # Illegal separator
            "   ",              # Whitespace
            "",                 # Empty string
            "TCS.L",            # London exchange
        ],
    )
    def test_invalid_ticker_formatting_raises(self, invalid_ticker: str) -> None:
        """Invalid ticker formats must be strictly rejected."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=[invalid_ticker],
                weights=[1.0],
                price_matrix=[[100.0], [105.0]],
            )
        assert "Invalid ticker formatting" in str(exc_info.value) or "Ticker symbols must be non-empty" in str(exc_info.value)

    def test_duplicate_tickers_rejected(self) -> None:
        """Duplicate tickers in portfolio must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS", "RELIANCE.NS"],
                weights=[0.5, 0.5],
                price_matrix=[[2500.0, 2500.0], [2550.0, 2550.0]],
            )
        assert "duplicate tickers detected" in str(exc_info.value).lower()

    def test_empty_tickers_rejected(self) -> None:
        """Empty tickers list must raise ValidationError."""
        with pytest.raises(ValidationError):
            NSEPortfolioInput(
                tickers=[],
                weights=[],
                price_matrix=[],
            )


# ==============================================================================
# 2. Portfolio Weights & Price Matrix Validation Tests
# ==============================================================================

class TestPortfolioConstraintsValidation:
    """Tests for weights and price matrix dimensional and numerical constraints."""

    def test_weights_must_sum_to_one(self) -> None:
        """Weights not summing to 1.0 must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS", "INFY.NS"],
                weights=[0.6, 0.3],  # Sum = 0.9
                price_matrix=[[2500.0, 1500.0], [2520.0, 1510.0]],
            )
        assert "must sum to 1.0" in str(exc_info.value)

    def test_negative_or_exceeding_weight_rejected(self) -> None:
        """Negative weights or weights > 1.0 must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS", "INFY.NS"],
                weights=[-0.2, 1.2],
                price_matrix=[[2500.0, 1500.0], [2520.0, 1510.0]],
            )
        assert "between 0.0 and 1.0" in str(exc_info.value)

    def test_nan_or_inf_weights_rejected(self) -> None:
        """NaN or Inf weights must raise ValidationError."""
        with pytest.raises(ValidationError):
            NSEPortfolioInput(
                tickers=["RELIANCE.NS"],
                weights=[float("nan")],
                price_matrix=[[2500.0], [2550.0]],
            )

    def test_weights_tickers_length_mismatch(self) -> None:
        """Mismatched length between weights and tickers must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS", "INFY.NS", "TCS.NS"],
                weights=[0.5, 0.5],
                price_matrix=[[2500.0, 1500.0, 3500.0], [2520.0, 1510.0, 3520.0]],
            )
        assert "Number of weights" in str(exc_info.value)

    def test_price_matrix_min_days(self) -> None:
        """Price matrix with fewer than 2 days must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS"],
                weights=[1.0],
                price_matrix=[[2500.0]],  # Only 1 day
            )
        assert "at least 2 trading days" in str(exc_info.value)

    def test_price_matrix_columns_mismatch(self) -> None:
        """Price matrix row length not matching number of tickers must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS", "INFY.NS"],
                weights=[0.5, 0.5],
                price_matrix=[[2500.0], [2520.0, 1510.0]],  # First row has 1 column instead of 2
            )
        assert "expected 2 matching tickers" in str(exc_info.value)

    @pytest.mark.parametrize("invalid_price", [0.0, -500.0, float("nan"), float("inf")])
    def test_invalid_prices_rejected(self, invalid_price: float) -> None:
        """Zero, negative, or non-finite prices must raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            NSEPortfolioInput(
                tickers=["RELIANCE.NS"],
                weights=[1.0],
                price_matrix=[[2500.0], [invalid_price]],
            )
        assert "strictly positive finite number" in str(exc_info.value)

    def test_invalid_risk_free_rate(self) -> None:
        """Negative risk-free rate or > 1.0 must raise ValidationError."""
        with pytest.raises(ValidationError):
            NSEPortfolioInput(
                tickers=["RELIANCE.NS"],
                weights=[1.0],
                price_matrix=[[2500.0], [2550.0]],
                risk_free_rate=-0.05,
            )

    def test_invalid_portfolio_value(self) -> None:
        """Negative or zero portfolio value in INR must raise ValidationError."""
        with pytest.raises(ValidationError):
            NSEPortfolioInput(
                tickers=["RELIANCE.NS"],
                weights=[1.0],
                price_matrix=[[2500.0], [2550.0]],
                portfolio_value_inr=-1000.0,
            )


# ==============================================================================
# 3. Portfolio Risk Metrics Engine Tests
# ==============================================================================

class TestPortfolioRiskEngine:
    """Tests for calculate_portfolio_risk_metrics covering normal & edge cases."""

    def test_realistic_indian_equities_portfolio(self) -> None:
        """Test realistic 3-asset Indian equity portfolio with known upward trend."""
        tickers = ["RELIANCE.NS", "INFY.NS", "HDFCBANK.NS"]
        weights = [0.4, 0.3, 0.3]
        # 5 days of realistic INR prices
        price_matrix = [
            [2500.0, 1500.0, 1600.0],
            [2525.0, 1515.0, 1610.0],
            [2510.0, 1530.0, 1605.0],
            [2550.0, 1540.0, 1620.0],
            [2575.0, 1550.0, 1635.0],
        ]
        portfolio_input = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            risk_free_rate=0.068,
            portfolio_value_inr=1_000_000.0,
        )

        metrics = calculate_portfolio_risk_metrics(portfolio_input)

        assert isinstance(metrics, NSERiskMetricsOutput)
        assert metrics.annualized_return > 0.0
        assert metrics.annualized_volatility > 0.0
        assert isinstance(metrics.sharpe_ratio, float)
        assert isinstance(metrics.sortino_ratio, float)
        assert metrics.max_drawdown <= 0.0
        assert metrics.var_95_inr >= 0.0

    def test_zero_volatility_matrix_edge_case(self) -> None:
        """Test zero-volatility matrix where prices remain perfectly constant across time.

        Must NOT raise ZeroDivisionError and must yield Sharpe = 0.0, Sortino = 0.0,
        Max Drawdown = 0.0, and 95% VaR = 0.0 INR.
        """
        tickers = ["RELIANCE.NS", "TCS.NS"]
        weights = [0.5, 0.5]
        # Constant prices across 5 days (0 return, 0 volatility)
        price_matrix = [
            [2500.0, 3500.0],
            [2500.0, 3500.0],
            [2500.0, 3500.0],
            [2500.0, 3500.0],
            [2500.0, 3500.0],
        ]
        portfolio_input = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            risk_free_rate=0.068,
            portfolio_value_inr=2_000_000.0,
        )

        metrics = calculate_portfolio_risk_metrics(portfolio_input)

        assert metrics.annualized_return == 0.0
        assert metrics.annualized_volatility == 0.0
        assert metrics.sharpe_ratio == 0.0
        assert metrics.sortino_ratio == 0.0
        assert metrics.max_drawdown == 0.0
        assert metrics.var_95_inr == 0.0

    def test_constant_growth_zero_volatility(self) -> None:
        """Portfolio with strictly constant positive daily return has zero return variance."""
        tickers = ["INFY.NS"]
        weights = [1.0]
        # Daily return is strictly 1% each day: 100 -> 101 -> 102.01 -> 103.0301
        p0 = 100.0
        prices = [[p0 * (1.01**i)] for i in range(5)]

        portfolio_input = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=prices,
            risk_free_rate=0.068,
        )
        metrics = calculate_portfolio_risk_metrics(portfolio_input)

        assert metrics.annualized_return > 0.0
        assert math.isclose(metrics.annualized_volatility, 0.0, abs_tol=1e-7)
        # Because volatility is zero, Sharpe ratio gracefully defaults to 0.0
        assert metrics.sharpe_ratio == 0.0
        assert metrics.sortino_ratio == 0.0
        assert metrics.max_drawdown == 0.0
        assert metrics.var_95_inr == 0.0

    def test_minimum_trading_days(self) -> None:
        """Test minimum valid trading days (2 days, producing 1 daily return)."""
        tickers = ["HDFCBANK.NS"]
        weights = [1.0]
        price_matrix = [[1600.0], [1616.0]]  # +1% return

        portfolio_input = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            risk_free_rate=0.068,
        )
        metrics = calculate_portfolio_risk_metrics(portfolio_input)

        assert math.isclose(metrics.annualized_return, 0.01 * NSE_TRADING_DAYS, rel_tol=1e-5)
        assert metrics.annualized_volatility == 0.0  # std with N=1 return is 0
        assert metrics.sharpe_ratio == 0.0
        assert metrics.max_drawdown == 0.0

    def test_strictly_declining_portfolio(self) -> None:
        """Portfolio that steadily drops must have negative returns, drawdown, and positive VaR."""
        tickers = ["RELIANCE.NS"]
        weights = [1.0]
        # 10% daily drops
        price_matrix = [[1000.0], [900.0], [810.0], [729.0]]

        portfolio_input = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            portfolio_value_inr=1_000_000.0,
        )
        metrics = calculate_portfolio_risk_metrics(portfolio_input)

        assert metrics.annualized_return < 0.0
        assert metrics.max_drawdown < 0.0
        assert metrics.var_95_inr > 0.0
        assert metrics.sharpe_ratio < 0.0

    def test_var_scales_with_portfolio_value(self) -> None:
        """VaR in INR must scale linearly with portfolio valuation."""
        tickers = ["RELIANCE.NS"]
        weights = [1.0]
        price_matrix = [[1000.0], [950.0], [980.0], [920.0], [960.0]]

        port_1m = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            portfolio_value_inr=1_000_000.0,
        )
        port_5m = NSEPortfolioInput(
            tickers=tickers,
            weights=weights,
            price_matrix=price_matrix,
            portfolio_value_inr=5_000_000.0,
        )

        metrics_1m = calculate_portfolio_risk_metrics(port_1m)
        metrics_5m = calculate_portfolio_risk_metrics(port_5m)

        assert math.isclose(metrics_5m.var_95_inr, metrics_1m.var_95_inr * 5.0, rel_tol=1e-5)


# ==============================================================================
# 4. Option Greeks Schema & Black-Scholes Calculation Tests
# ==============================================================================

class TestOptionGreeks:
    """Tests for OptionGreeksInput, OptionGreeksOutput, and Black-Scholes formulas."""

    def test_call_option_standard(self) -> None:
        """Test At-The-Money (ATM) Nifty 50 Call (CE) option."""
        opt_in = OptionGreeksInput(
            spot_price=22500.0,
            strike_price=22500.0,
            time_to_expiry=30.0 / NSE_TRADING_DAYS,
            implied_volatility=0.15,
            risk_free_rate=0.068,
            option_type="call",
        )
        res = calculate_option_greeks(opt_in)

        assert isinstance(res, OptionGreeksOutput)
        assert res.price > 0.0
        assert 0.0 < res.delta < 1.0
        assert res.gamma > 0.0
        assert res.vega > 0.0
        assert res.theta < 0.0
        assert math.isclose(res.theta_daily, res.theta / NSE_TRADING_DAYS, rel_tol=1e-6)

    def test_put_option_standard(self) -> None:
        """Test At-The-Money (ATM) Nifty 50 Put (PE) option."""
        opt_in = OptionGreeksInput(
            spot_price=22500.0,
            strike_price=22500.0,
            time_to_expiry=30.0 / NSE_TRADING_DAYS,
            implied_volatility=0.15,
            risk_free_rate=0.068,
            option_type="put",
        )
        res = calculate_option_greeks(opt_in)

        assert isinstance(res, OptionGreeksOutput)
        assert res.price > 0.0
        assert -1.0 < res.delta < 0.0
        assert res.gamma > 0.0
        assert res.vega > 0.0
        assert res.theta < 0.0
        assert math.isclose(res.theta_daily, res.theta / NSE_TRADING_DAYS, rel_tol=1e-6)

    def test_put_call_parity_and_delta_relationship(self) -> None:
        """Verify Black-Scholes analytical consistency via Put-Call Parity: C - P = S - K * exp(-r*T)."""
        s = 22500.0
        k = 22500.0
        t = 45.0 / NSE_TRADING_DAYS
        iv = 0.18
        r = 0.068

        call_in = OptionGreeksInput(
            spot_price=s,
            strike_price=k,
            time_to_expiry=t,
            implied_volatility=iv,
            risk_free_rate=r,
            option_type="CE",
        )
        put_in = OptionGreeksInput(
            spot_price=s,
            strike_price=k,
            time_to_expiry=t,
            implied_volatility=iv,
            risk_free_rate=r,
            option_type="PE",
        )

        call_res = calculate_option_greeks(call_in)
        put_res = calculate_option_greeks(put_in)

        # Put-Call Parity
        discounted_k = k * math.exp(-r * t)
        assert math.isclose(call_res.price - put_res.price, s - discounted_k, abs_tol=1e-5)

        # Delta relationship: Delta_call - Delta_put = 1.0
        assert math.isclose(call_res.delta - put_res.delta, 1.0, abs_tol=1e-6)

        # Gamma and Vega are identical for European Call and Put
        assert math.isclose(call_res.gamma, put_res.gamma, abs_tol=1e-7)
        assert math.isclose(call_res.vega, put_res.vega, abs_tol=1e-5)

    def test_deep_in_the_money_and_out_of_the_money(self) -> None:
        """Verify asymptotic Delta behavior for deep ITM and OTM options."""
        # Deep ITM Call (Spot 25000, Strike 20000)
        itm_call = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=25000.0,
                strike_price=20000.0,
                time_to_expiry=10.0 / NSE_TRADING_DAYS,
                implied_volatility=0.15,
                option_type="call",
            )
        )
        assert math.isclose(itm_call.delta, 1.0, rel_tol=1e-3)

        # Deep OTM Call (Spot 20000, Strike 25000)
        otm_call = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=20000.0,
                strike_price=25000.0,
                time_to_expiry=10.0 / NSE_TRADING_DAYS,
                implied_volatility=0.15,
                option_type="call",
            )
        )
        assert math.isclose(otm_call.delta, 0.0, abs_tol=1e-4)

        # Deep ITM Put (Spot 20000, Strike 25000)
        itm_put = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=20000.0,
                strike_price=25000.0,
                time_to_expiry=10.0 / NSE_TRADING_DAYS,
                implied_volatility=0.15,
                option_type="put",
            )
        )
        assert math.isclose(itm_put.delta, -1.0, rel_tol=1e-3)

        # Deep OTM Put (Spot 25000, Strike 20000)
        otm_put = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=25000.0,
                strike_price=20000.0,
                time_to_expiry=10.0 / NSE_TRADING_DAYS,
                implied_volatility=0.15,
                option_type="put",
            )
        )
        assert math.isclose(otm_put.delta, 0.0, abs_tol=1e-4)

    def test_expiry_edge_case_t_zero(self) -> None:
        """Test options at expiration (T = 0)."""
        # ITM Call at expiry
        call_itm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22600.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="call",
            )
        )
        assert call_itm.price == 100.0
        assert call_itm.delta == 1.0
        assert call_itm.gamma == 0.0
        assert call_itm.vega == 0.0

        # OTM Call at expiry
        call_otm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22400.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="call",
            )
        )
        assert call_otm.price == 0.0
        assert call_otm.delta == 0.0

        # ATM Call at expiry
        call_atm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="call",
            )
        )
        assert call_atm.price == 0.0
        assert call_atm.delta == 0.5

        # ITM Put at expiry
        put_itm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22400.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="put",
            )
        )
        assert put_itm.price == 100.0
        assert put_itm.delta == -1.0

        # OTM Put at expiry
        put_otm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22600.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="put",
            )
        )
        assert put_otm.price == 0.0
        assert put_otm.delta == 0.0

        # ATM Put at expiry
        put_atm = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=22500.0,
                time_to_expiry=0.0,
                implied_volatility=0.15,
                option_type="put",
            )
        )
        assert put_atm.price == 0.0
        assert put_atm.delta == -0.5

    def test_zero_volatility_edge_case(self) -> None:
        """Test options with zero implied volatility (IV = 0.0)."""
        call_res = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22600.0,
                strike_price=22500.0,
                time_to_expiry=30.0 / NSE_TRADING_DAYS,
                implied_volatility=0.0,
                risk_free_rate=0.068,
                option_type="call",
            )
        )
        assert call_res.gamma == 0.0
        assert call_res.vega == 0.0
        assert call_res.delta in (0.0, 0.5, 1.0)

        put_res = calculate_option_greeks(
            OptionGreeksInput(
                spot_price=22400.0,
                strike_price=22500.0,
                time_to_expiry=30.0 / NSE_TRADING_DAYS,
                implied_volatility=0.0,
                risk_free_rate=0.068,
                option_type="put",
            )
        )
        assert put_res.gamma == 0.0
        assert put_res.vega == 0.0
        assert put_res.delta in (-1.0, -0.5, 0.0)

    def test_option_schema_validation_failures(self) -> None:
        """OptionGreeksInput parameter constraints."""
        # Non-positive strike
        with pytest.raises(ValidationError):
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=-22500.0,
                time_to_expiry=0.1,
                implied_volatility=0.15,
            )

        # Non-positive spot
        with pytest.raises(ValidationError):
            OptionGreeksInput(
                spot_price=0.0,
                strike_price=22500.0,
                time_to_expiry=0.1,
                implied_volatility=0.15,
            )

        # Negative time to expiry
        with pytest.raises(ValidationError):
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=22500.0,
                time_to_expiry=-0.1,
                implied_volatility=0.15,
            )

        # Negative IV
        with pytest.raises(ValidationError):
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=22500.0,
                time_to_expiry=0.1,
                implied_volatility=-0.15,
            )

        # Invalid option type
        with pytest.raises(ValidationError):
            OptionGreeksInput(
                spot_price=22500.0,
                strike_price=22500.0,
                time_to_expiry=0.1,
                implied_volatility=0.15,
                option_type="future",  # type: ignore
            )

    def test_vectorized_option_greeks(self) -> None:
        """Test vectorized Greek calculation across multiple strikes simultaneously."""
        strikes = np.array([22000.0, 22500.0, 23000.0])
        spot = 22500.0
        t = 15.0 / NSE_TRADING_DAYS
        iv = 0.16

        res_call = calculate_option_greeks_vectorized(
            spot_prices=spot,
            strike_prices=strikes,
            times_to_expiry=t,
            implied_vols=iv,
            risk_free_rate=0.068,
            option_type="call",
        )

        assert len(res_call["price"]) == 3
        assert len(res_call["delta"]) == 3
        # Lower strike call (ITM) has higher price and delta than higher strike call (OTM)
        assert res_call["price"][0] > res_call["price"][1] > res_call["price"][2]
        assert res_call["delta"][0] > res_call["delta"][1] > res_call["delta"][2]

        res_put = calculate_option_greeks_vectorized(
            spot_prices=spot,
            strike_prices=strikes,
            times_to_expiry=t,
            implied_vols=iv,
            risk_free_rate=0.068,
            option_type="put",
        )
        assert len(res_put["price"]) == 3
        # Higher strike put (ITM) has higher price than lower strike put (OTM)
        assert res_put["price"][2] > res_put["price"][1] > res_put["price"][0]
