"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Database,
  Cpu,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { ReasoningStep } from "@/types/terminal";

interface ReasoningStepItemProps {
  step: ReasoningStep;
}

export const ReasoningStepItem: React.FC<ReasoningStepItemProps> = ({ step }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (step.status) {
      case "running":
        return (
          <div className="relative flex items-center justify-center">
            <span className="w-4 h-4 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          </div>
        );
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "fallback":
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getBadgeStyle = () => {
    switch (step.badgeType) {
      case "quant":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800/60";
      case "db":
        return "bg-purple-950/80 text-purple-300 border-purple-800/60";
      case "cache":
        return "bg-amber-950/80 text-amber-300 border-amber-800/60";
      case "hitl":
        return "bg-rose-950/80 text-rose-300 border-rose-800/60";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const getToolIcon = () => {
    if (step.title.includes("NumPy") || step.title.includes("Risk")) {
      return <Cpu className="w-3.5 h-3.5 text-cyan-400" />;
    }
    if (step.title.includes("pgvector") || step.title.includes("BSE")) {
      return <Database className="w-3.5 h-3.5 text-purple-400" />;
    }
    if (step.title.includes("HITL") || step.title.includes("Rebalance")) {
      return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
    }
    return <Layers className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-2.5 transition-all duration-150 hover:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0">{getStatusIcon()}</div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex-shrink-0">{getToolIcon()}</span>
            <span className="text-xs font-medium text-slate-200 truncate font-mono">
              {step.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium ${getBadgeStyle()}`}
          >
            {step.badge}
          </span>
          {step.details && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
              title="Inspect tool payload"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {step.description && (
        <p className="mt-1 text-[11px] text-slate-400 font-sans pl-6.5">{step.description}</p>
      )}

      {isExpanded && step.details && (
        <div className="mt-2 pl-6.5">
          <pre className="text-[10px] font-mono bg-slate-950 p-2 rounded border border-slate-800 text-slate-300 overflow-x-auto max-h-36">
            {JSON.stringify(step.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
