"use client";

import React from "react";
import { TrendingUp, ShieldAlert, Award, IndianRupee } from "lucide-react";
import { PortfolioMetrics } from "@/types/terminal";

interface KpiRiskCardsProps {
  metrics: PortfolioMetrics;
  isRebalanced?: boolean;
}

// Indian Number Formatter for INR Currency (₹,##,###)
export const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const KpiRiskCards: React.FC<KpiRiskCardsProps> = ({ metrics, isRebalanced = false }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Sharpe Ratio Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition-all duration-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:bg-cyan-500/10 transition-colors" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Sharpe Ratio
          </span>
          <Award className="w-4 h-4 text-cyan-400" />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {metrics.sharpe_ratio.toFixed(2)}
          </span>
          {isRebalanced && (
            <span className="text-xs font-mono font-semibold text-emerald-400">
              (+0.22 ▲)
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>vs 6.82% RBI G-Sec</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            252 NSE Days
          </span>
        </div>
      </div>

      {/* 2. Sortino Ratio Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition-all duration-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-colors" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Sortino Ratio
          </span>
          <TrendingUp className="w-4 h-4 text-purple-400" />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {metrics.sortino_ratio.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-slate-400">downside</span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Downside Risk Alpha</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
            High Quality
          </span>
        </div>
      </div>

      {/* 3. Max Drawdown Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/50 transition-all duration-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-colors" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Max Drawdown
          </span>
          <ShieldAlert className="w-4 h-4 text-rose-400" />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
            {(metrics.max_drawdown * 100).toFixed(2)}%
          </span>
          {isRebalanced && (
            <span className="text-xs font-mono font-semibold text-emerald-400">
              (-0.57% risk)
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Peak-to-Trough</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60">
            Nifty: -12.8%
          </span>
        </div>
      </div>

      {/* 4. 95% 1-Day VaR Card in INR */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition-all duration-200 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-colors" />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            95% 1-Day VaR (INR)
          </span>
          <IndianRupee className="w-4 h-4 text-amber-400" />
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
            {formatINR(metrics.var_95_inr)}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>1.15% Portfolio Base</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
            ₹1.24 Cr Nav
          </span>
        </div>
      </div>
    </div>
  );
};
