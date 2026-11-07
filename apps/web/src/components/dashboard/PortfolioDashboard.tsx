"use client";

import React from "react";
import {
  PortfolioMetrics,
  SectorExposure,
  RebalanceProposal,
} from "@/types/terminal";
import { KpiRiskCards, formatINR } from "./KpiRiskCards";
import { PerformanceChart } from "./PerformanceChart";
import { SectorHeatmap } from "./SectorHeatmap";
import {
  TrendingUp,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Sparkles,
  PieChart,
} from "lucide-react";

interface PortfolioDashboardProps {
  metrics: PortfolioMetrics;
  exposures: SectorExposure[];
  isRebalanced: boolean;
  onTriggerRebalance: () => void;
  activeProposal: RebalanceProposal | null;
}

export const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({
  metrics,
  exposures,
  isRebalanced,
  onTriggerRebalance,
  activeProposal,
}) => {
  const dayGainInr = 85420;
  const dayGainPct = 0.69;

  return (
    <div className="flex flex-col h-full bg-[#070b14] overflow-y-auto p-4 sm:p-5 space-y-4">
      {/* Portfolio Top Status Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#0d1424] via-[#0e172a] to-[#0a101d] border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              NSE Active Portfolio Valuation
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Nifty 50 Alpha Core
            </span>
            {isRebalanced && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold animate-pulse">
                REBALANCED (RULE 5 CONFIRMED)
              </span>
            )}
          </div>

          <div className="mt-1 flex items-baseline gap-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {formatINR(metrics.portfolio_value_inr)}
            </h2>
            <div className="flex items-center text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>+{formatINR(dayGainInr)}</span>
              <span className="ml-1 text-[10px]">(+{dayGainPct}%) Today</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Last NAV Refresh: 15:30 IST</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>HITL State: Synchronized</span>
          </div>
        </div>
      </div>

      {/* 1. KPI Risk Cards Grid */}
      <KpiRiskCards metrics={metrics} isRebalanced={isRebalanced} />

      {/* 2. Recharts Performance Time-Series Chart */}
      <PerformanceChart isRebalanced={isRebalanced} />

      {/* 3. Sector Exposure Heatmap */}
      <SectorHeatmap
        exposures={exposures}
        onTriggerRebalance={onTriggerRebalance}
        pendingRebalance={!!activeProposal && activeProposal.status === "pending"}
      />
    </div>
  );
};
