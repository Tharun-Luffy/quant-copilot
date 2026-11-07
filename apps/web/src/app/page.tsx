"use client";

import React, { useState } from "react";
import { TerminalHeader } from "@/components/terminal/TerminalHeader";
import { ReasoningStream } from "@/components/terminal/ReasoningStream";
import { PortfolioDashboard } from "@/components/dashboard/PortfolioDashboard";
import { HitlApprovalModal } from "@/components/modal/HitlApprovalModal";
import {
  PortfolioMetrics,
  SectorExposure,
  RebalanceProposal,
} from "@/types/terminal";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function TerminalWorkspacePage() {
  // Global Market & Cache State (SYSTEM_SPEC Rule 4)
  const [isStale, setIsStale] = useState<boolean>(false);
  const [staleTimestamp, setStaleTimestamp] = useState<string | null>(null);

  // Rebalance State (SYSTEM_SPEC Rule 5)
  const [isRebalanced, setIsRebalanced] = useState<boolean>(false);
  const [isHitlModalOpen, setIsHitlModalOpen] = useState<boolean>(false);
  const [showSuccessToast, setShowSuccessToast] = useState<boolean>(false);

  // Active Rebalance Proposal
  const [activeProposal, setActiveProposal] = useState<RebalanceProposal | null>({
    id: "reb_default_01",
    timestamp: "2025-10-13T09:30:00.000Z",
    action: "Trim 10% IT, Allocate to Private Banking",
    rationale:
      "Large-cap IT multiples trade at 32.4x forward P/E (1.4σ above 5-year mean). Private Banking offers attractive risk-adjusted yield and credit growth. Rebalancing reduces 1-Day 95% VaR by ₹14,450 while expanding Sharpe from 1.84 to 2.06.",
    oldAllocations: { IT: 35, Banking: 30, Energy: 20, FMCG: 15 },
    newAllocations: { IT: 25, Banking: 40, Energy: 20, FMCG: 15 },
    expectedSharpeChange: { from: 1.84, to: 2.06 },
    expectedVarChangeInr: { from: 142850, to: 128400 },
    expectedMaxDrawdownChange: { from: -7.42, to: -6.85 },
    status: "pending",
  });

  // Reactive Portfolio Metrics (Indian Market Conventions: 252 Days, INR)
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    annualized_return: 0.1845,
    annualized_volatility: 0.138,
    sharpe_ratio: 1.84,
    sortino_ratio: 2.45,
    max_drawdown: -0.0742,
    var_95_inr: 142850,
    portfolio_value_inr: 12450000,
  });

  // Reactive Sector Exposures
  const [exposures, setExposures] = useState<SectorExposure[]>([
    {
      sector: "IT",
      weight: 0.35,
      targetWeight: 0.25,
      allocationInr: 4357500,
      dailyChange: -0.4,
      topTickers: ["TCS.NS", "INFY.NS", "WIPRO.NS"],
      color: "#06b6d4",
    },
    {
      sector: "Banking",
      weight: 0.3,
      targetWeight: 0.4,
      allocationInr: 3735000,
      dailyChange: 1.4,
      topTickers: ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS"],
      color: "#6366f1",
    },
    {
      sector: "Energy",
      weight: 0.2,
      targetWeight: 0.2,
      allocationInr: 2490000,
      dailyChange: 0.6,
      topTickers: ["RELIANCE.NS", "NTPC.NS", "ONGC.NS"],
      color: "#f59e0b",
    },
    {
      sector: "FMCG",
      weight: 0.15,
      targetWeight: 0.15,
      allocationInr: 1867500,
      dailyChange: 0.2,
      topTickers: ["ITC.NS", "HINDUNILVR.NS"],
      color: "#10b981",
    },
  ]);

  // Handle HITL Proposal Emitted by Agent
  const handleRebalanceProposed = (proposal: RebalanceProposal) => {
    setActiveProposal(proposal);
    setIsHitlModalOpen(true);
  };

  // Handle Explicit User Click Confirmation (Rule 5 State Mutation)
  const handleConfirmRebalance = (proposal: RebalanceProposal) => {
    setIsRebalanced(true);
    setActiveProposal((prev) => (prev ? { ...prev, status: "approved" } : null));

    // Mutate Portfolio Metrics
    setMetrics({
      annualized_return: 0.208,
      annualized_volatility: 0.132,
      sharpe_ratio: proposal.expectedSharpeChange.to,
      sortino_ratio: 2.78,
      max_drawdown: proposal.expectedMaxDrawdownChange.to / 100,
      var_95_inr: proposal.expectedVarChangeInr.to,
      portfolio_value_inr: 12450000,
    });

    // Mutate Sector Exposures
    setExposures([
      {
        sector: "IT",
        weight: 0.25,
        targetWeight: 0.25,
        allocationInr: 3112500,
        dailyChange: -0.4,
        topTickers: ["TCS.NS", "INFY.NS"],
        color: "#06b6d4",
      },
      {
        sector: "Banking",
        weight: 0.4,
        targetWeight: 0.4,
        allocationInr: 4980000,
        dailyChange: 1.8,
        topTickers: ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS"],
        color: "#6366f1",
      },
      {
        sector: "Energy",
        weight: 0.2,
        targetWeight: 0.2,
        allocationInr: 2490000,
        dailyChange: 0.6,
        topTickers: ["RELIANCE.NS", "NTPC.NS"],
        color: "#f59e0b",
      },
      {
        sector: "FMCG",
        weight: 0.15,
        targetWeight: 0.15,
        allocationInr: 1867500,
        dailyChange: 0.2,
        topTickers: ["ITC.NS", "HINDUNILVR.NS"],
        color: "#10b981",
      },
    ]);

    // Show Confirmation Toast
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 5000);
  };

  const handleSetIsStale = (stale: boolean, timestamp?: string) => {
    setIsStale(stale);
    if (timestamp) setStaleTimestamp(timestamp);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-slate-100 font-sans">
      {/* Terminal Header */}
      <TerminalHeader
        isStale={isStale}
        staleTimestamp={staleTimestamp}
        onOpenHitlModal={() => setIsHitlModalOpen(true)}
        pendingHitlCount={activeProposal && activeProposal.status === "pending" ? 1 : 0}
      />

      {/* Main Dual-Pane Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Pane (40%): Live SSE Conversational Stream */}
        <section className="w-full lg:w-[40%] h-1/2 lg:h-full flex flex-col min-w-0">
          <ReasoningStream
            onRebalanceProposed={handleRebalanceProposed}
            onSetIsStale={handleSetIsStale}
            onOpenHitlModal={() => setIsHitlModalOpen(true)}
            activeProposal={activeProposal}
          />
        </section>

        {/* Right Pane (60%): Reactive Dashboard with Recharts */}
        <section className="w-full lg:w-[60%] h-1/2 lg:h-full flex flex-col min-w-0 border-t lg:border-t-0 lg:border-l border-slate-800">
          <PortfolioDashboard
            metrics={metrics}
            exposures={exposures}
            isRebalanced={isRebalanced}
            onTriggerRebalance={() => setIsHitlModalOpen(true)}
            activeProposal={activeProposal}
          />
        </section>
      </main>

      {/* Interactive Human-in-the-Loop Approval Modal (Rule 5) */}
      <HitlApprovalModal
        isOpen={isHitlModalOpen}
        onClose={() => setIsHitlModalOpen(false)}
        proposal={activeProposal}
        onConfirm={handleConfirmRebalance}
      />

      {/* Rebalance Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0e1b15] border border-emerald-500/60 rounded-xl p-4 shadow-2xl shadow-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold font-mono text-emerald-300">
              REBALANCE ORDER EXECUTED ON NSE
            </div>
            <div className="text-[11px] text-slate-300">
              IT trimmed to 25.0% (-10%) | Banking expanded to 40.0% (+10%). Sharpe updated to 2.06.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
