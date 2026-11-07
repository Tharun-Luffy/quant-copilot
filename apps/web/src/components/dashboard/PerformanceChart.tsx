"use client";

import React, { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { TimeSeriesPoint } from "@/types/terminal";

// Historical 252 NSE Trading Days Mock Dataset
const generateHistoricalData = (isRebalanced: boolean): TimeSeriesPoint[] => {
  const points: TimeSeriesPoint[] = [];
  const baseValue = 100.0; // Index 100
  const basePortfolioInrLakhs = 105.0; // ₹1.05 Cr base
  const baseNiftyInrLakhs = 105.0;

  const dates = [
    "Oct 24", "Nov 24", "Dec 24", "Jan 25", "Feb 25", "Mar 25",
    "Apr 25", "May 25", "Jun 25", "Jul 25", "Aug 25", "Sep 25", "Oct 25"
  ];

  // Progression of cumulative return
  const niftyReturns = [0.0, 1.8, 3.2, 2.9, 4.6, 6.2, 7.8, 9.4, 11.2, 12.8, 13.9, 14.5, 15.2];
  const portReturns = [0.0, 2.4, 4.1, 4.0, 6.2, 8.5, 10.4, 12.1, 14.6, 16.2, 17.1, 17.8, isRebalanced ? 20.8 : 18.5];

  for (let i = 0; i < dates.length; i++) {
    const portPct = portReturns[i];
    const niftyPct = niftyReturns[i];
    points.push({
      date: dates[i],
      portfolio: Number(portPct.toFixed(2)),
      benchmark: Number(niftyPct.toFixed(2)),
      portfolioVal: Number((basePortfolioInrLakhs * (1 + portPct / 100)).toFixed(2)),
      benchmarkVal: Number((baseNiftyInrLakhs * (1 + niftyPct / 100)).toFixed(2)),
    });
  }

  return points;
};

interface PerformanceChartProps {
  isRebalanced?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
  viewMode: "percent" | "valuation";
}

const CustomTooltip = ({ active, payload, label, viewMode }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const portVal = payload.find((p) => p.dataKey === (viewMode === "percent" ? "portfolio" : "portfolioVal"));
    const benchVal = payload.find((p) => p.dataKey === (viewMode === "percent" ? "benchmark" : "benchmarkVal"));

    const portNum = portVal ? Number(portVal.value) : 0;
    const benchNum = benchVal ? Number(benchVal.value) : 0;
    const alpha = (portNum - benchNum).toFixed(2);

    return (
      <div className="bg-[#0b101c]/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-[200px]">
        <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-slate-400">NSE Close</span>
        </div>

        <div className="flex items-center justify-between text-cyan-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Portfolio (Alpha):
          </span>
          <span className="font-bold">
            {viewMode === "percent" ? `+${portNum.toFixed(2)}%` : `₹${portNum.toFixed(2)}L`}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            NIFTY 50 Index:
          </span>
          <span className="font-bold text-slate-300">
            {viewMode === "percent" ? `+${benchNum.toFixed(2)}%` : `₹${benchNum.toFixed(2)}L`}
          </span>
        </div>

        <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
          <span className="text-emerald-400">Alpha Outperformance:</span>
          <span className="font-bold text-emerald-400">
            {viewMode === "percent" ? `+${alpha}%` : `+₹${alpha}L`}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ isRebalanced = false }) => {
  const [timeframe, setTimeframe] = useState<"3M" | "6M" | "1Y" | "252D">("252D");
  const [viewMode, setViewMode] = useState<"percent" | "valuation">("percent");

  const fullData = generateHistoricalData(isRebalanced);
  const data =
    timeframe === "3M"
      ? fullData.slice(-4)
      : timeframe === "6M"
      ? fullData.slice(-7)
      : fullData;

  const portKey = viewMode === "percent" ? "portfolio" : "portfolioVal";
  const benchKey = viewMode === "percent" ? "benchmark" : "benchmarkVal";

  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col space-y-3">
      {/* Chart Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">
              Portfolio Performance vs NIFTY 50 Benchmark
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              {isRebalanced ? "ALPHA: +5.60%" : "ALPHA: +3.25%"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Relative return time-series over 252 NSE trading calendar days
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center text-[10px] font-mono">
            <button
              onClick={() => setViewMode("percent")}
              className={`px-2 py-1 rounded ${
                viewMode === "percent"
                  ? "bg-slate-800 text-cyan-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Return %
            </button>
            <button
              onClick={() => setViewMode("valuation")}
              className={`px-2 py-1 rounded ${
                viewMode === "valuation"
                  ? "bg-slate-800 text-cyan-400 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              INR Value (₹L)
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center text-[10px] font-mono">
            {(["3M", "6M", "1Y", "252D"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded ${
                  timeframe === tf
                    ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/80"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Recharts Area */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
            />

            <YAxis
              stroke="#64748b"
              fontSize={11}
              fontFamily="monospace"
              tickLine={false}
              axisLine={{ stroke: "#334155" }}
              tickFormatter={(v) => (viewMode === "percent" ? `${v}%` : `₹${v}L`)}
            />

            <Tooltip
              content={<CustomTooltip viewMode={viewMode} />}
              cursor={{ stroke: "#475569", strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {/* Benchmark Line */}
            <Line
              type="monotone"
              dataKey={benchKey}
              name="NIFTY 50 Benchmark"
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
            />

            {/* Portfolio Area with Gradient */}
            <Area
              type="monotone"
              dataKey={portKey}
              name="Portfolio (Alpha)"
              stroke="#06b6d4"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#portfolioGradient)"
              dot={{ fill: "#06b6d4", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#22d3ee", stroke: "#083344", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
