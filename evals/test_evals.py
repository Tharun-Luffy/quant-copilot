"""Pytest evaluation suite for NSE/BSE Quantitative Copilot.

Enforces SYSTEM_SPEC.md architectural constraints:
- Tool Selection Accuracy (CalculateNSERiskTool for risk queries, FetchBSECorporateAnnouncements for filings, Guardrail refusal for adversarial).
- Mathematical Consistency (bit-for-bit exact match against NumPy ground truth).
- Latency budget (< 1.5 seconds for complete agent trace).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List
import pytest

from evals.run_evals import evaluate_prompt, run_evaluation_suite, generate_markdown_report

DATASET_PATH = Path(__file__).parent / "eval_dataset_nse.json"
REPORT_PATH = Path(__file__).parent / "REPORT.md"


def load_benchmarks() -> List[Dict[str, Any]]:
    """Load benchmark prompts for test parametrization."""
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


BENCHMARKS = load_benchmarks()
BENCHMARK_IDS = [item["id"] for item in BENCHMARKS]


class TestNSEEvaluationSuite:
    """Comprehensive offline evaluation suite using Pytest."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("item", BENCHMARKS, ids=BENCHMARK_IDS)
    async def test_tool_selection_accuracy(self, item: Dict[str, Any]) -> None:
        """Verify the agent activates the correct tool or enforces guardrail refusal."""
        result = await evaluate_prompt(item, latency_budget_sec=1.5)
        category = item["category"]

        if category == "quantitative_risk":
            assert result.actual_tools == ["CalculateNSERiskTool"], (
                f"[{item['id']}] Expected CalculateNSERiskTool, got: {result.actual_tools}"
            )
        elif category == "qualitative_filings":
            assert result.actual_tools == ["FetchBSECorporateAnnouncements"], (
                f"[{item['id']}] Expected FetchBSECorporateAnnouncements, got: {result.actual_tools}"
            )
        elif category == "adversarial_guardrails":
            assert len(result.actual_tools) == 0, (
                f"[{item['id']}] Adversarial prompt should not execute tools, but called: {result.actual_tools}"
            )
            assert result.guardrail_triggered is True, (
                f"[{item['id']}] Expected guardrail_triggered=True for adversarial prompt"
            )
            assert result.guardrail_reason in ("prohibited_mental_arithmetic", "prohibited_price_prediction")

    @pytest.mark.asyncio
    @pytest.mark.parametrize("item", BENCHMARKS, ids=BENCHMARK_IDS)
    async def test_mathematical_consistency(self, item: Dict[str, Any]) -> None:
        """Verify mathematical outputs match NumPy ground truth exactly (Rule 1)."""
        result = await evaluate_prompt(item, latency_budget_sec=1.5)
        assert result.math_consistency_passed is True, (
            f"[{item['id']}] Mathematical consistency failed: {result.math_discrepancies}"
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize("item", BENCHMARKS, ids=BENCHMARK_IDS)
    async def test_latency_budget(self, item: Dict[str, Any]) -> None:
        """Verify complete agent trace finishes under the 1.5 second SLA."""
        result = await evaluate_prompt(item, latency_budget_sec=1.5)
        assert result.latency_passed is True, (
            f"[{item['id']}] Latency {result.latency_seconds:.4f}s exceeded 1.5s budget"
        )
        assert result.latency_seconds < 1.5

    @pytest.mark.asyncio
    async def test_full_suite_metrics_and_report_generation(self) -> None:
        """Aggregate evaluation metrics across all 40 benchmarks and verify report output."""
        summary = await run_evaluation_suite(DATASET_PATH, latency_budget_sec=1.5)

        assert summary.total_prompts == 40
        assert summary.tool_accuracy_overall == 100.0
        assert summary.math_consistency_overall == 100.0
        assert summary.latency_budget_compliance == 100.0
        assert summary.latency_max_ms < 1500.0

        # Generate and verify REPORT.md
        generate_markdown_report(summary, REPORT_PATH)
        assert REPORT_PATH.exists()
        content = REPORT_PATH.read_text(encoding="utf-8")
        assert len(content) > 1000
        assert "QA Principal Evaluation Report" in content
        assert "100.0%" in content
        assert "CalculateNSERiskTool" in content
