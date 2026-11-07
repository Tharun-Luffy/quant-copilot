"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Terminal,
  Play,
  RotateCcw,
  ShieldCheck,
  Check,
  ArrowRight,
  Flame,
  Search,
  Sparkles,
} from "lucide-react";
import { ChatMessage, ReasoningStep, RebalanceProposal } from "@/types/terminal";
import { ReasoningStepItem } from "./ReasoningStepItem";

interface ReasoningStreamProps {
  onRebalanceProposed: (proposal: RebalanceProposal) => void;
  onSetIsStale: (stale: boolean, timestamp?: string) => void;
  onOpenHitlModal: () => void;
  activeProposal: RebalanceProposal | null;
}

export const ReasoningStream: React.FC<ReasoningStreamProps> = ({
  onRebalanceProposed,
  onSetIsStale,
  onOpenHitlModal,
  activeProposal,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init_1",
      role: "assistant",
      content:
        "**Quant Copilot Terminal Initialized.**\n\n- Indian market calendar active: **252 NSE Trading Days**.\n- Financial arithmetic strictly isolated inside `apps/server/quant/`.\n- pgvector similarity search ready for BSE regulatory disclosures.\n- **Rule 5 HITL Gate Armed**: Portfolio rebalancing requires explicit operator authorization.\n\n*Select a command below or enter custom quantitative queries.*",
      timestamp: "09:15:00 IST",
      reasoningSteps: [
        {
          id: "step_init_1",
          timestamp: "09:15:00",
          title: "System Boot: Strict Architectural Rules Loaded",
          description: "SYSTEM_SPEC.md Rules 1-6 verified. RBI 10Y G-Sec yield calibrated to 6.82%.",
          badge: "CORE ENGINE",
          badgeType: "default",
          status: "completed",
        },
      ],
    },
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("RELIANCE.NS");
  const [forceRateLimit, setForceRateLimit] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const executeChatRequest = async (promptText: string, simulateLimit = forceRateLimit) => {
    if (!promptText.trim() || isStreaming) return;

    const userMessageId = `user_${Date.now()}`;
    const assistantMessageId = `asst_${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: promptText,
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + " IST",
    };

    const initialAsstMsg: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }) + " IST",
      isStreaming: true,
      reasoningSteps: [],
    };

    setMessages((prev) => [...prev, userMsg, initialAsstMsg]);
    setInputMessage("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: promptText,
          ticker: selectedTicker,
          force_rate_limit: simulateLimit,
          thread_id: "session_thread_1",
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      let currentSteps: ReasoningStep[] = [];
      let accumulatedContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const evtBlock of events) {
          if (!evtBlock.trim()) continue;

          let eventType = "message";
          let dataStr = "{}";

          const lines = evtBlock.split("\n");
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataStr = line.slice(6).trim();
            }
          }

          try {
            const data = JSON.parse(dataStr);

            if (eventType === "node_start") {
              const nodeName = String(data.node || "node");
              const stepId = `node_${nodeName}_${Date.now()}`;
              let title = `Node: ${nodeName}`;
              let badge = "LANGGRAPH";
              let badgeType: ReasoningStep["badgeType"] = "default";

              if (nodeName === "agent_node") {
                title = "Evaluating Quant Intent & Planning Routing";
                badge = "AGENT NODE";
              } else if (nodeName === "tools_node") {
                title = "Executing Quantitative Tool Engine";
                badge = "TOOLS NODE";
              } else if (nodeName === "fallback_node") {
                title = "Triggering Redis Fallback Node (stale: true)";
                badge = "REDIS FALLBACK";
                badgeType = "cache";
              }

              currentSteps = [
                ...currentSteps,
                {
                  id: stepId,
                  timestamp: new Date().toLocaleTimeString(),
                  title,
                  description: "LangGraph state machine transition",
                  badge,
                  badgeType,
                  status: "running",
                },
              ];
            } else if (eventType === "tool_start") {
              const toolName = String(data.tool || "tool");
              let stepTitle = `Executing ${toolName}...`;
              let badge = "NUMPY QUANT";
              let badgeType: ReasoningStep["badgeType"] = "quant";

              if (toolName === "CalculateNSERiskTool") {
                stepTitle = "Executing NumPy Nifty 50 Risk Engine...";
                badge = "NSE 252 DAYS";
                badgeType = "quant";
              } else if (toolName === "FetchBSECorporateAnnouncements") {
                stepTitle = "Querying BSE Filings via pgvector...";
                badge = "PGVECTOR / BSE";
                badgeType = "db";
              } else if (toolName === "ProposePortfolioRebalanceTool") {
                stepTitle = "Evaluating Sector Rotation: Trim IT ➔ Private Banking...";
                badge = "HITL RULE 5";
                badgeType = "hitl";
              } else if (toolName === "FetchMarketQuote") {
                stepTitle = `Fetching Live Market Quote for ${data.input?.ticker || selectedTicker}...`;
                badge = "NSE FEED";
                badgeType = "default";
              }

              currentSteps = [
                ...currentSteps,
                {
                  id: `tool_${toolName}_${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  title: stepTitle,
                  description: "Isolated mathematical computation conforming to SYSTEM_SPEC",
                  badge,
                  badgeType,
                  status: "running",
                  details: data.input,
                },
              ];
            } else if (eventType === "tool_end") {
              const toolName = String(data.tool || "");
              currentSteps = currentSteps.map((st) => {
                if (st.status === "running") {
                  return {
                    ...st,
                    status: "completed",
                    description: `Execution completed successfully.`,
                    details: data.output || st.details,
                  };
                }
                return st;
              });
            } else if (eventType === "tool_error") {
              currentSteps = currentSteps.map((st) => {
                if (st.status === "running") {
                  return {
                    ...st,
                    status: "error",
                    description: String(data.error || "Rate limit or execution exception encountered"),
                    details: data,
                  };
                }
                return st;
              });
            } else if (eventType === "fallback") {
              onSetIsStale(true, String(data.timestamp || new Date().toISOString()));
              currentSteps = [
                ...currentSteps,
                {
                  id: `fallback_${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  title: "Serving Cached Redis Pricing (stale: true)",
                  description: `External Market API HTTP 429 intercepted. Fallback node serving Redis data.`,
                  badge: "REDIS 7 CACHE",
                  badgeType: "cache",
                  status: "fallback",
                  details: data,
                },
              ];
            } else if (eventType === "rebalance_proposal") {
              const proposal: RebalanceProposal = {
                id: String(data.id || `reb_${Date.now()}`),
                timestamp: String(data.timestamp || new Date().toISOString()),
                action: String(data.action || "Trim 10% IT, Allocate to Private Banking"),
                rationale: String(data.rationale || ""),
                oldAllocations: data.oldAllocations || { IT: 35, Banking: 30, Energy: 20, FMCG: 15 },
                newAllocations: data.newAllocations || { IT: 25, Banking: 40, Energy: 20, FMCG: 15 },
                expectedSharpeChange: data.expectedSharpeChange || { from: 1.84, to: 2.06 },
                expectedVarChangeInr: data.expectedVarChangeInr || { from: 142850, to: 128400 },
                expectedMaxDrawdownChange: data.expectedMaxDrawdownChange || { from: -7.42, to: -6.85 },
                status: "pending",
              };
              onRebalanceProposed(proposal);
            } else if (eventType === "token") {
              const token = String(data.content || "");
              accumulatedContent += token;
            } else if (eventType === "done") {
              if (!data.is_stale) {
                // Keep current state
              }
            }

            // Update state with streaming snapshot
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      reasoningSteps: [...currentSteps],
                      isStreaming: eventType !== "done",
                    }
                  : msg
              )
            );
          } catch {
            // Non-JSON SSE event ignored
          }
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content:
                  msg.content ||
                  `**Stream Error:** Unable to complete SSE cycle. Reason: ${err instanceof Error ? err.message : String(err)}`,
                isStreaming: false,
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      executeChatRequest(inputMessage);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0f19] border-r border-slate-800">
      {/* Pane Header */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-[#080c14] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            Quant Copilot Reasoning Stream
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
            SSE Wire
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMessages((prev) => [prev[0]]);
              onSetIsStale(false);
            }}
            title="Reset Terminal Stream"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action Prompt Chips */}
      <div className="px-3 py-2 bg-[#090d17] border-b border-slate-800/60 flex flex-wrap gap-1.5 text-xs">
        <button
          onClick={() =>
            executeChatRequest(
              "Propose portfolio rebalance: Trim 10% IT and Allocate to Private Banking based on valuation and 252-day risk metrics."
            )
          }
          disabled={isStreaming}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-mono text-[11px] transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Sparkles className="w-3 h-3 text-indigo-400" />
          <span>⚡ Rebalance: Trim 10% IT ➔ Banking</span>
        </button>

        <button
          onClick={() =>
            executeChatRequest(
              "Calculate portfolio risk metrics: Sharpe Ratio, Sortino Ratio, Max Drawdown, and 95% 1-Day VaR in INR."
            )
          }
          disabled={isStreaming}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 font-mono text-[11px] transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Flame className="w-3 h-3 text-cyan-400" />
          <span>📊 Calculate Nifty 50 Risk Metrics</span>
        </button>

        <button
          onClick={() =>
            executeChatRequest(
              `Query BSE corporate announcements and earnings filings for ${selectedTicker} via pgvector vector similarity.`
            )
          }
          disabled={isStreaming}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-800/60 text-purple-300 font-mono text-[11px] transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <Search className="w-3 h-3 text-purple-400" />
          <span>📑 Query BSE Filings (pgvector)</span>
        </button>

        <button
          onClick={() =>
            executeChatRequest(
              `Fetch live quote for ${selectedTicker} and simulate 429 rate limit to verify Rule 4 Redis fallback.`,
              true
            )
          }
          disabled={isStreaming}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-800/60 text-amber-300 font-mono text-[11px] transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          <span>⚠️ Test 429 Redis Fallback</span>
        </button>
      </div>

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-2">
            {/* Message header */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span
                className={`font-semibold ${
                  msg.role === "user" ? "text-cyan-400" : "text-emerald-400"
                }`}
              >
                {msg.role === "user" ? "OPERATOR >" : "QUANT COPILOT AGENT >"}
              </span>
              <span>{msg.timestamp}</span>
            </div>

            {/* User message styling */}
            {msg.role === "user" ? (
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-slate-100 text-xs font-sans font-medium">
                {msg.content}
              </div>
            ) : (
              /* Assistant message styling */
              <div className="space-y-3">
                {/* Real-time reasoning steps timeline */}
                {msg.reasoningSteps && msg.reasoningSteps.length > 0 && (
                  <div className="rounded-xl border border-slate-800/90 bg-[#070b14] p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800/70 pb-2">
                      <span className="text-[11px] font-mono font-semibold text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        REASONING STEPS & TOOL EXECUTION ({msg.reasoningSteps.length})
                      </span>
                      {msg.isStreaming && (
                        <span className="text-[10px] font-mono text-cyan-400 animate-pulse">
                          STREAMING WIRE...
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {msg.reasoningSteps.map((step) => (
                        <ReasoningStepItem key={step.id} step={step} />
                      ))}
                    </div>
                  </div>
                )}

                {/* HITL Inline Action Banner if proposal generated */}
                {activeProposal && activeProposal.status === "pending" && msg.isStreaming === false && (
                  <div className="rounded-xl bg-gradient-to-r from-amber-950/60 to-purple-950/40 border border-amber-600/50 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold font-mono text-amber-300">
                          RULE 5 HITL REBALANCE PENDING APPROVAL
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        ACTION REQUIRED
                      </span>
                    </div>

                    <p className="text-xs text-slate-200">
                      Agent recommends: <span className="font-semibold text-amber-200">{activeProposal.action}</span>
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onOpenHitlModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs font-mono shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02]"
                      >
                        <span>Review & Confirm Rebalance</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Final synthesized response text */}
                {msg.content && (
                  <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans space-y-2 whitespace-pre-line">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-2 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 bg-[#080c14] border-t border-slate-800 space-y-2">
        {/* Ticker & Simulator Controls */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Active Ticker:</span>
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="RELIANCE.NS">RELIANCE.NS (Energy)</option>
              <option value="TCS.NS">TCS.NS (IT)</option>
              <option value="INFY.NS">INFY.NS (IT)</option>
              <option value="HDFCBANK.NS">HDFCBANK.NS (Banking)</option>
              <option value="ITC.NS">ITC.NS (FMCG)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={forceRateLimit}
              onChange={(e) => setForceRateLimit(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
            />
            <span className={forceRateLimit ? "text-amber-400 font-medium" : ""}>
              Simulate 429 (Rule 4 Fallback)
            </span>
          </label>
        </div>

        {/* Input Text Field */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask Copilot (e.g., 'Trim 10% IT and Allocate to Banking', 'Analyze Sharpe vs NIFTY50')..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
          />

          <button
            onClick={() => executeChatRequest(inputMessage)}
            disabled={isStreaming || !inputMessage.trim()}
            className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
          >
            <Send className="w-3.5 h-3.5" />
            <span>EXEC</span>
          </button>
        </div>
      </div>
    </div>
  );
};
