"use client";

import React from "react";
import { ShieldCheck, Activity, AlertTriangle, Cpu, RefreshCw } from "lucide-react";

interface TerminalHeaderProps {
  isStale: boolean;
  staleTimestamp?: string | null;
  onOpenHitlModal: () => void;
  pendingHitlCount?: number;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  isStale,
  staleTimestamp,
  onOpenHitlModal,
  pendingHitlCount = 0,
}) => {
  return (
    <header className="border-b border-slate-800 bg-[#090d16]/95 backdrop-blur-md sticky top-0 z-30">
      {/* Top Ticker Tape */}
      <div className="bg-[#05070c] border-b border-slate-900 px-4 py-1.5 flex items-center justify-between text-xs font-mono overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-6 text-slate-400">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-semibold tracking-wider">NSE LIVE</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300 font-medium">NIFTY 50:</span>
            <span className="text-emerald-400 font-bold">24,842.60</span>
            <span className="text-emerald-500 text-[10px]">(+0.42%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">SENSEX:</span>
            <span className="text-emerald-400 font-bold">81,450.20</span>
            <span className="text-emerald-500 text-[10px]">(+0.38%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">NIFTY BANK:</span>
            <span className="text-emerald-400 font-bold">51,280.15</span>
            <span className="text-emerald-500 text-[10px]">(+0.68%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">INDIA VIX:</span>
            <span className="text-rose-400 font-bold">12.85</span>
            <span className="text-rose-500 text-[10px]">(-2.13%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">RBI 10Y G-Sec:</span>
            <span className="text-cyan-400 font-bold">6.82%</span>
            <span className="text-slate-500 text-[10px]">(Rf)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 font-medium">USD/INR:</span>
            <span className="text-slate-200 font-bold">₹83.94</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-4">
          <span className="text-slate-500 text-[11px]">252 NSE Trading Days Calendar</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 text-[11px]">IST (UTC+5:30)</span>
        </div>
      </div>

      {/* Main Terminal Bar */}
      <div className="px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black tracking-tighter">
            QC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                QUANT COPILOT
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  Terminal v1.0
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              Indian Equities Quantitative Risk & Corporate Intelligence Engine (NSE / BSE)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stale Cache Alert (SYSTEM_SPEC Rule 4) */}
          {isStale && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs font-mono animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>STALE: TRUE (Redis Cache)</span>
              {staleTimestamp && (
                <span className="text-amber-500 text-[10px]">
                  {new Date(staleTimestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          )}

          {/* Engine Status */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>NumPy Core: Active</span>
          </div>

          {/* HITL Rebalance Badge (SYSTEM_SPEC Rule 5) */}
          <button
            onClick={onOpenHitlModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all duration-200 border ${
              pendingHitlCount > 0
                ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/20 animate-pulse"
                : "bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border-indigo-700/50"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>HITL GATE (Rule 5)</span>
            {pendingHitlCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center">
                {pendingHitlCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
