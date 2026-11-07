"use client";

import React from "react";
import { SectorExposure, SectorName } from "@/types/terminal";
import { Layers, ArrowUpRight, ArrowDownRight, RefreshCw, Sparkles } from "lucide-react";
import { formatINR } from "./KpiRiskCards";

interface SectorHeatmapProps {
  exposures: SectorExposure[];
  onTriggerRebalance: () => void;
  pendingRebalance?: boolean;
}

export const SectorHeatmap: React.FC<SectorHeatmapProps> = ({
  exposures,
  onTriggerRebalance,
  pendingRebalance = false,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Sector Exposure Heatmap (NSE Long-Only)
            </h3>
          </div>
          <p className="text-[11px] text-slate-400">
            Real-time capital allocation and sectoral factor risk
          </p>
        </div>

        <button
          onClick={onTriggerRebalance}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-300 font-mono text-xs font-semibold shadow-md transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Propose HITL Rebalance</span>
        </button>
      </div>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {exposures.map((sec) => {
          const weightPct = (sec.weight * 100).toFixed(1);
          const isPositive = sec.dailyChange >= 0;

          return (
            <div
              key={sec.sector}
              className="p-3.5 rounded-xl bg-[#0d1322] border border-slate-800/90 relative overflow-hidden transition-all duration-200 hover:border-slate-700 group"
            >
              {/* Heat Color Intensity Bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: sec.color }}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white tracking-wide">
                  {sec.sector}
                </span>

                <div
                  className={`flex items-center text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    isPositive
                      ? "text-emerald-400 bg-emerald-950/60 border border-emerald-800/40"
                      : "text-rose-400 bg-rose-950/60 border border-rose-800/40"
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 mr-0.5" />
                  )}
                  {isPositive ? `+${sec.dailyChange}%` : `${sec.dailyChange}%`}
                </div>
              </div>

              {/* Allocation Weights */}
              <div className="mt-2.5 flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-bold font-mono text-white tracking-tight">
                    {weightPct}%
                  </span>
                  <span className="ml-1 text-[10px] text-slate-400 font-mono">weight</span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-medium text-slate-300">
                    {formatINR(sec.allocationInr)}
                  </span>
                </div>
              </div>

              {/* Target Allocation if rebalance proposed */}
              {sec.targetWeight !== undefined && sec.targetWeight !== sec.weight && (
                <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono bg-slate-950/60 px-2 py-1 rounded border border-slate-800">
                  <span className="text-slate-400">Target Weight:</span>
                  <span
                    className={`font-bold ${
                      sec.targetWeight > sec.weight ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {(sec.targetWeight * 100).toFixed(1)}% (
                    {sec.targetWeight > sec.weight ? "+" : ""}
                    {((sec.targetWeight - sec.weight) * 100).toFixed(1)}%)
                  </span>
                </div>
              )}

              {/* Relative Weight Visual Bar */}
              <div className="mt-2.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${weightPct}%`,
                    backgroundColor: sec.color,
                  }}
                />
              </div>

              {/* Constituent Tickers */}
              <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Holdings:</span>
                <span className="text-slate-300 truncate max-w-[140px]">
                  {sec.topTickers.join(", ")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
