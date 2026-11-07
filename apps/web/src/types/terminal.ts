export type SectorName = "IT" | "Banking" | "Energy" | "FMCG";

export interface SectorExposure {
  sector: SectorName;
  weight: number; // e.g. 0.35 for 35%
  targetWeight?: number;
  allocationInr: number;
  dailyChange: number; // e.g. 1.2 for +1.2%
  topTickers: string[];
  color: string;
}

export interface PortfolioMetrics {
  annualized_return: number; // decimal, e.g. 0.185 (18.5%)
  annualized_volatility: number; // decimal, e.g. 0.142 (14.2%)
  sharpe_ratio: number; // e.g. 1.84
  sortino_ratio: number; // e.g. 2.45
  max_drawdown: number; // decimal, e.g. -0.0742 (-7.42%)
  var_95_inr: number; // INR value, e.g. 142850
  portfolio_value_inr: number; // INR, e.g. 12450000
}

export interface TimeSeriesPoint {
  date: string;
  portfolio: number; // percentage return from base
  benchmark: number; // NIFTY50 percentage return
  portfolioVal: number; // in INR Lakhs
  benchmarkVal: number; // in INR Lakhs
}

export interface ReasoningStep {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  badge: string;
  badgeType?: "quant" | "db" | "cache" | "hitl" | "default";
  status: "pending" | "running" | "completed" | "fallback" | "error";
  details?: Record<string, unknown>;
}

export interface RebalanceProposal {
  id: string;
  timestamp: string;
  action: string;
  rationale: string;
  oldAllocations: Record<SectorName, number>;
  newAllocations: Record<SectorName, number>;
  expectedSharpeChange: { from: number; to: number };
  expectedVarChangeInr: { from: number; to: number };
  expectedMaxDrawdownChange: { from: number; to: number };
  status: "pending" | "approved" | "rejected";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  reasoningSteps?: ReasoningStep[];
  isStreaming?: boolean;
  isStale?: boolean;
  rebalanceProposal?: RebalanceProposal;
}

export interface SSEWireEvent {
  event: string;
  data: Record<string, unknown>;
}
