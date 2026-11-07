"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Lock,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { RebalanceProposal, SectorName } from "@/types/terminal";
import { formatINR } from "../dashboard/KpiRiskCards";

interface HitlApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: RebalanceProposal | null;
  onConfirm: (proposal: RebalanceProposal) => void;
}

export const HitlApprovalModal: React.FC<HitlApprovalModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!isOpen || !proposal) return null;

  const totalNavInr = 12450000; // ₹1.245 Cr

  const sectors: Array<{
    name: SectorName;
    oldPct: number;
    newPct: number;
    color: string;
  }> = [
    {
      name: "IT",
      oldPct: proposal.oldAllocations.IT ?? 35,
      newPct: proposal.newAllocations.IT ?? 25,
      color: "#06b6d4",
    },
    {
      name: "Banking",
      oldPct: proposal.oldAllocations.Banking ?? 30,
      newPct: proposal.newAllocations.Banking ?? 40,
      color: "#6366f1",
    },
    {
      name: "Energy",
      oldPct: proposal.oldAllocations.Energy ?? 20,
      newPct: proposal.newAllocations.Energy ?? 20,
      color: "#f59e0b",
    },
    {
      name: "FMCG",
      oldPct: proposal.oldAllocations.FMCG ?? 15,
      newPct: proposal.newAllocations.FMCG ?? 15,
      color: "#10b981",
    },
  ];

  const handleConfirmClick = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsConfirmed(true);
      setTimeout(() => {
        onConfirm(proposal);
        setIsConfirmed(false);
        onClose();
      }, 900);
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0d121f] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#080d18] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold font-mono tracking-tight text-white uppercase">
                  Human-in-the-Loop Rebalance Approval Gate
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-semibold">
                  RULE 5 ENFORCED
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Explicit operator click authorization required before state mutation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Action Callout */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-800/60 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                Proposed State Mutation:
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Ref: {proposal.id}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight">
              {proposal.action}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {proposal.rationale ||
                "Trim 10% IT exposure due to stretched valuation multiples and reallocate into Private Banking to enhance risk-adjusted yield."}
            </p>
          </div>

          {/* Allocation Comparison Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200">SECTORAL REBALANCE BREAKDOWN</span>
              <div className="flex items-center gap-6">
                <span>OLD ALLOCATION</span>
                <span>➔</span>
                <span className="text-emerald-400 font-semibold">NEW ALLOCATION</span>
              </div>
            </div>

            <div className="space-y-3">
              {sectors.map((sec) => {
                const diff = sec.newPct - sec.oldPct;
                const capitalDeltaInr = (diff / 100) * totalNavInr;

                return (
                  <div
                    key={sec.name}
                    className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: sec.color }}
                        />
                        <span className="font-bold text-white font-mono">{sec.name}</span>
                        {diff !== 0 && (
                          <span
                            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex items-center ${
                              diff > 0
                                ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {diff > 0 ? (
                              <ArrowUpRight className="w-3 h-3 mr-0.5" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 mr-0.5" />
                            )}
                            {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`} (
                            {formatINR(capitalDeltaInr)})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-slate-400">{sec.oldPct.toFixed(1)}%</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                        <span
                          className={`font-bold ${
                            diff > 0
                              ? "text-emerald-400"
                              : diff < 0
                              ? "text-amber-400"
                              : "text-slate-300"
                          }`}
                        >
                          {sec.newPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Dual Progress Bars Comparison */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 w-8">Old:</span>
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full opacity-60"
                            style={{
                              width: `${sec.oldPct}%`,
                              backgroundColor: sec.color,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400 w-8 font-semibold">
                          New:
                        </span>
                        <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${sec.newPct}%`,
                              backgroundColor: sec.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Expected Risk Metric Impacts */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
            <span className="text-xs font-mono font-bold text-slate-300 uppercase">
              Projected Risk Metric Impacts (252 NSE Days)
            </span>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Expected Sharpe
                </span>
                <div className="mt-1 text-sm font-bold font-mono text-emerald-400">
                  {proposal.expectedSharpeChange.from} ➔ {proposal.expectedSharpeChange.to}
                </div>
                <span className="text-[10px] text-emerald-500 font-mono">+0.22 Alpha</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  1-Day 95% VaR
                </span>
                <div className="mt-1 text-xs font-bold font-mono text-amber-300">
                  {formatINR(proposal.expectedVarChangeInr.from)} ➔{" "}
                  {formatINR(proposal.expectedVarChangeInr.to)}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">-₹14,450 Risk</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Max Drawdown
                </span>
                <div className="mt-1 text-sm font-bold font-mono text-rose-400">
                  {proposal.expectedMaxDrawdownChange.from}% ➔{" "}
                  {proposal.expectedMaxDrawdownChange.to}%
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">+0.57% Preservation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with Explicit Action Buttons */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#080d18] flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isSubmitting || isConfirmed}
            className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
          >
            Reject Proposal
          </button>

          <button
            onClick={handleConfirmClick}
            disabled={isSubmitting || isConfirmed}
            className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shadow-lg transition-all duration-200 ${
              isConfirmed
                ? "bg-emerald-500 text-slate-950 shadow-emerald-500/30"
                : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-amber-500/25 hover:scale-[1.02] active:scale-[0.98]"
            } disabled:opacity-50`}
          >
            {isConfirmed ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>STATE MUTATED & REBALANCED</span>
              </>
            ) : isSubmitting ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                <span>TRANSMITTING ORDER TO OMS...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>CONFIRM & EXECUTE REBALANCE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
