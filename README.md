# 🚀 Quant Copilot (NSE/BSE)

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.4+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/pgvector-PostgreSQL%2016-336791.svg)](https://github.com/pgvector/pgvector)
[![Redis](https://img.shields.io/badge/Redis-7%20Alpine-DC382D.svg)](https://redis.io/)
[![Pytest Coverage](https://img.shields.io/badge/Pytest-100%25%20Passed-brightgreen.svg)](file:///home/tharun/projects/quant-copilot/evals/REPORT.md)

An institutional-grade **Quantitative Risk and Corporate Intelligence Copilot** tailored specifically for the **Indian Equities Market (NSE & BSE)**. 

Quant Copilot couples conversational AI with high-precision, deterministic quantitative financial algorithms and real-time filings intelligence. It adheres to strict financial safety constraints: eliminating LLM arithmetic hallucinations, enforcing Indian market conventions, providing automated cache fallbacks during market API outages, and requiring human operator approval for portfolio state mutations.

---

## 📑 Table of Contents

- [Core Purpose & Value Proposition](#-core-purpose--value-proposition)
- [Architectural Rules (`SYSTEM_SPEC.md`)](#-architectural-rules-system_specmd)
- [System Architecture](#-system-architecture)
- [Monorepo Directory Structure](#-monorepo-directory-structure)
- [End-to-End Workflow & Execution Lifecycle](#-end-to-end-workflow--execution-lifecycle)
- [Quickstart & Installation](#-quickstart--installation)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Infrastructure Setup (Docker Compose)](#2-infrastructure-setup-docker-compose)
  - [3. Backend Setup (FastAPI & LangGraph)](#3-backend-setup-fastapi--langgraph)
  - [4. Frontend Setup (Next.js Terminal)](#4-frontend-setup-nextjs-terminal)
- [Testing & Offline Evaluation Suite](#-testing--offline-evaluation-suite)
- [Agent Tools & Pydantic Schemas](#-agent-tools--pydantic-schemas)
- [Guardrails & Safety Interventions](#-guardrails--safety-interventions)

---

## 🎯 Core Purpose & Value Proposition

Standard Large Language Models frequently fail in high-stakes financial operations due to three critical flaws:
1. **Arithmetic Hallucinations:** Inaccurate calculation of metrics like Sharpe Ratios, Portfolio Volatility, or Value-at-Risk (VaR).
2. **Contextual Misalignment:** Assuming US conventions (250 trading days, USD risk-free rates like US Treasuries) instead of Indian market norms (252 NSE trading days, INR denomination, RBI 10-Year G-Sec yield).
3. **Uncontrolled Execution:** Attempting automated order placement without human supervision or crashing when upstream market APIs encounter HTTP 429 rate limits.

**Quant Copilot solves this** by decoupling reasoning from math, enforcing strict Pydantic v2 schemas, executing all calculations in a vectorized NumPy/SciPy engine, integrating a cyclic LangGraph state machine with automatic Redis fallback, and incorporating Human-in-the-Loop (HITL) confirmation.

---

## 🛡️ Architectural Rules (`SYSTEM_SPEC.md`)

All components in this repository strictly adhere to the six architectural directives defined in [`SYSTEM_SPEC.md`](file:///home/tharun/projects/quant-copilot/SYSTEM_SPEC.md):

1. **Isolated Quantitative Math:** The LLM must **NEVER** perform financial arithmetic, Sharpe/Beta/Sortino calculations, or option risk math mentally. All math executes deterministically inside [`apps/server/quant/`](file:///home/tharun/projects/quant-copilot/apps/server/quant/).
2. **Indian Market Conventions:** All financial figures account for Indian market standards:
   - Currency: **INR (₹)**
   - Annualization Factor: **252 NSE trading days** ($\sqrt{252}$ for volatility)
   - Benchmark Risk-Free Rate: **6.8% (RBI 10-Year G-Sec yield)**
   - Ticker Taxonomy: NSE (`.NS`), BSE (`.BO`), and national indices (`NIFTY50`, `BANKNIFTY`, `SENSEX`).
3. **Pydantic v2 Validation:** All tool inputs and outputs adhere strictly to typed Pydantic v2 schemas (`extra="forbid"`, positive prices, normalized weights summing to 1.0).
4. **Redis Fallback on HTTP 429:** If an external market API fails or rate-limits, LangGraph routes to a `fallback_node` serving cached Redis data flagged with `stale: true` and an ISO-8601 timestamp.
5. **Human-in-the-Loop (HITL) State Mutation:** Portfolio rebalancing proposals and order submissions require an explicit operator approval step in the UI before any state mutation occurs.
6. **Strict Static Typing:** 100% compliant with Python `mypy --strict` and TypeScript `strict: true`.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph UI ["Frontend (Next.js 16 + React 19 + TailwindCSS)"]
        User(["Trader / Analyst"])
        Terminal["Bloomberg-Style Terminal UI"]
        Dashboard["Portfolio Metrics & Exposure Charts"]
        HITLModal["HITL Approval Modal"]
    end

    subgraph API ["FastAPI Gateway (/api/chat)"]
        SSE["SSE Event Streamer"]
    end

    subgraph Agent ["Cyclic LangGraph State Machine"]
        AgentNode["agent_node\n(Intent & Guardrail Analysis)"]
        ToolsNode["tools_node\n(Tool Dispatcher)"]
        FallbackNode["fallback_node\n(Redis Cache Resolver)"]
        GuardrailRefusal["Guardrail Refusal\n(Prohibits Mental Math / Predictions)"]
    end

    subgraph Quant ["Deterministic Quantitative Engine"]
        Engine["apps/server/quant/engine.py\n(NumPy / SciPy Vectorized Math)"]
        Schemas["apps/server/quant/schemas.py\n(Pydantic v2 Models)"]
    end

    subgraph Storage ["Infrastructure (Docker Compose)"]
        Postgres[("PostgreSQL 16 + pgvector\n(Filings & Embeddings)")]
        RedisCache[("Redis 7 Alpine\n(L1 Price Cache & Fallback)")]
    end

    User -->|Prompts & Queries| Terminal
    Terminal -->|POST JSON Request| SSE
    SSE -->|Initialize State| AgentNode

    AgentNode -->|Adversarial Check| GuardrailRefusal
    AgentNode -->|Requires Computation| ToolsNode
    ToolsNode -->|Invoke CalculateNSERiskTool| Engine
    Engine <--> Schemas
    ToolsNode -->|Invoke FetchBSECorporateAnnouncements| Postgres
    ToolsNode -->|HTTP 429 Rate Limit| FallbackNode
    FallbackNode <-->|Read Cached Price (stale: true)| RedisCache
    FallbackNode -->|Return Cached State| AgentNode

    ToolsNode -->|Output Metrics| AgentNode
    AgentNode -->|HITL Rebalance Proposal| HITLModal
    HITLModal -->|Explicit Operator Approval| Dashboard
    AgentNode -->|Stream Tokens & Events| SSE
    SSE -->|Live Event Stream| Terminal
```

---

## 📂 Monorepo Directory Structure

```bash
quant-copilot/
├── .env.example                 # Template for PostgreSQL and Redis connection variables
├── .gitignore                   # Git ignore specifications (Python, Next.js, Docker, logs)
├── docker-compose.yml           # Multi-container setup (pgvector/pgvector:pg16, redis:7-alpine)
├── pyproject.toml               # Pytest, Mypy strict configuration & Python path definitions
├── requirements.txt             # Root Python dependencies
├── SYSTEM_SPEC.md               # 6 non-negotiable architectural directives
│
├── apps/
│   ├── server/                  # Backend Python FastAPI application & LangGraph Agent
│   │   ├── main.py              # FastAPI application entrypoint & CORS middleware
│   │   ├── requirements.txt     # Server-specific Python packages
│   │   ├── agents/              # LangGraph multi-agent implementation
│   │   │   ├── graph.py         # Cyclic state graph, fallback routing & SSE stream execution
│   │   │   ├── state.py         # AgentState TypedDict definition
│   │   │   └── tools.py         # LangChain tools (CalculateNSERiskTool, FetchBSE, FetchMarketQuote)
│   │   ├── api/
│   │   │   └── chat.py          # /api/chat Server-Sent Events (SSE) streaming endpoint
│   │   ├── core/                # Core system services and connectors
│   │   │   ├── config.py        # Pydantic BaseSettings loading environment configurations
│   │   │   ├── db.py            # PostgreSQL + asyncpg pool & mock filing repository
│   │   │   └── redis_client.py  # Redis async client & price caching logic
│   │   └── quant/               # Mathematical quant engine (Rule 1 compliance)
│   │       ├── engine.py        # Vectorized Sharpe, Sortino, VaR, Max Drawdown, Black-Scholes Greeks
│   │       └── schemas.py       # Pydantic v2 models (NSEPortfolioInput, NSERiskMetricsOutput, etc.)
│   │
│   └── web/                     # Frontend Next.js 16 Web Application
│       ├── package.json         # React 19, Lucide, Recharts, TailwindCSS dependencies
│       ├── tsconfig.json        # Strict TypeScript configuration
│       └── src/
│           ├── app/             # Next.js App Router (page.tsx, layout.tsx, globals.css)
│           ├── components/
│           │   ├── dashboard/   # Portfolio overview cards, sector exposure charts, risk metrics
│           │   ├── modal/       # Human-in-the-Loop (HITL) approval dialog
│           │   └── terminal/    # Bloomberg-styled terminal header, log viewer, reasoning stream
│           └── types/           # TypeScript definitions for metrics, proposals, and events
│
├── evals/                       # Automated Offline Evaluation Benchmark Suite
│   ├── build_dataset.py         # Synthetic generation script for 40 golden benchmarks
│   ├── eval_dataset_nse.json    # 40 golden test cases (Quant risk, BSE filings, Adversarial prompts)
│   ├── run_evals.py             # Evaluation harness evaluating accuracy, math consistency, and latency
│   ├── test_evals.py            # Parametrized Pytest suite asserting SLAs
│   └── REPORT.md                # QA Principal Evaluation Report (100% passed across all criteria)
│
└── tests/                       # Unit & Integration Regression Test Suites
    ├── test_agents.py           # Unit tests for LangGraph nodes, tools, and fallback mechanisms
    └── test_quant.py            # Comprehensive tests for math precision, put-call parity, edge cases
```

---

## 🔄 End-to-End Workflow & Execution Lifecycle

### 1. Quantitative Portfolio Risk Analysis
- **User Action:** Submits portfolio tickers, weights, and historical price matrices (e.g., RELIANCE.NS, TCS.NS, HDFCBANK.NS).
- **Execution Flow:** 
  1. `agent_node` identifies analytical intent and dispatches `CalculateNSERiskTool`.
  2. Input data is validated by [`NSEPortfolioInput`](file:///home/tharun/projects/quant-copilot/apps/server/quant/schemas.py).
  3. [`calculate_portfolio_risk_metrics`](file:///home/tharun/projects/quant-copilot/apps/server/quant/engine.py) computes annualized returns, standard deviation ($\times \sqrt{252}$), Sharpe & Sortino ratios (using RBI 10Y G-Sec 6.8%), 1-day 95% Historical VaR (INR), and peak-to-trough Drawdown.
  4. Formatted metrics are streamed back via Server-Sent Events to the Next.js dashboard.

### 2. BSE / NSE Corporate Announcements Intelligence
- **User Action:** Asks for recent quarterly earnings, board meetings, or dividend filings for a company.
- **Execution Flow:**
  1. `agent_node` recognizes qualitative disclosure request.
  2. Tool `FetchBSECorporateAnnouncements` queries the PostgreSQL repository with filters for ticker, quarter, and announcement type.
  3. Structured filings are synthesized into chronological disclosures for the terminal stream.

### 3. API Rate-Limiting & Redis Fallback (Rule 4)
- **Outage Scenario:** Upstream market quotes provider returns `HTTP 429 Too Many Requests`.
- **Execution Flow:**
  1. `tools_node` catches `MarketAPIRateLimitError`.
  2. The LangGraph cyclic router switches execution to `fallback_node`.
  3. `fallback_node` retrieves the last verified price from Redis (`redis_cache.get_cached_pricing`).
  4. The response payload is stamped with `stale: true` and an ISO-8601 timestamp.
  5. The UI surfaces an amber cache banner warning the analyst that cached data is being served.

### 4. Human-in-the-Loop (HITL) Rebalancing (Rule 5)
- **Rebalance Scenario:** The agent formulates a sector rotation or portfolio trim proposal (e.g., trim IT from 35% to 25%, increase Private Banking from 30% to 40%).
- **Execution Flow:**
  1. `agent_node` flags `hitl_pending: true` and emits a structured `rebalance_proposal` event.
  2. The Next.js frontend catches the event and opens the `HitlApprovalModal`.
  3. **No database or portfolio state mutation is permitted** until the human operator reviews projected alpha/drawdown changes and clicks **"Confirm & Execute Rebalance"**.

### 5. Adversarial Guardrails & Refusals
- **Adversarial Attempt:** User prompts the agent to calculate financial metrics mentally ("in your head", "without tools") or predict future stock prices ("what will Reliance trade at next Friday?").
- **Execution Flow:**
  1. `agent_node` evaluates guardrail regex triggers.
  2. The agent refuses the prompt immediately without executing tools.
  3. Refusal messages explicitly cite `SYSTEM_SPEC.md Rule 1` or the Indian market speculative prediction policy.

---

## ⚡ Quickstart & Installation

### 1. Prerequisites
- **Python:** Version 3.12 or higher
- **Node.js:** Version 20.x or higher (with `npm`)
- **Docker & Docker Compose:** For running PostgreSQL (pgvector) and Redis

### 2. Infrastructure Setup (Docker Compose)
Start the PostgreSQL (pgvector) database and Redis cache instances:

```bash
docker compose up -d
```

Verify that both containers are healthy:
```bash
docker compose ps
```
- PostgreSQL pgvector runs on `localhost:5432`
- Redis 7 Alpine runs on `localhost:6379`

### 3. Backend Setup (FastAPI & LangGraph)

1. Activate your Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables (defaults match Docker Compose):
   ```bash
   cp .env.example .env
   ```

4. Launch the FastAPI server:
   ```bash
   uvicorn apps.server.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The backend API will be accessible at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 4. Frontend Setup (Next.js Terminal)

1. Navigate to the web workspace:
   ```bash
   cd apps/web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000` to interact with the terminal dashboard.

---

## 🧪 Testing & Offline Evaluation Suite

The repository includes comprehensive unit tests and an offline evaluation benchmark suite verifying adherence to all latency, mathematical precision, and tool accuracy budgets.

### Run Unit Tests
```bash
# Test quantitative math engine, put-call parity, edge cases
pytest tests/test_quant.py -v

# Test LangGraph agents, Redis fallback, and SSE chat endpoints
pytest tests/test_agents.py -v
```

### Run the 40-Prompt Offline Evaluation Suite
The offline evaluation suite runs against [`evals/eval_dataset_nse.json`](file:///home/tharun/projects/quant-copilot/evals/eval_dataset_nse.json) without external network dependencies:

```bash
# Run standalone evaluation harness and regenerate evals/REPORT.md
python evals/run_evals.py

# Run via Pytest
pytest evals/test_evals.py -v
```

### Benchmark Results Summary ([`evals/REPORT.md`](file:///home/tharun/projects/quant-copilot/evals/REPORT.md))

| Dimension | Target Budget | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Tool Selection Accuracy** | 100.0% | **100.0%** | ✅ PASSED |
| **Mathematical Consistency** (NumPy exact) | 100.0% | **100.0%** | ✅ PASSED |
| **Latency Budget Compliance** (< 1.5s SLA) | 100.0% | **100.0%** | ✅ PASSED |
| **Average Execution Latency** | < 1,500 ms | **0.37 ms** | ✅ PASSED |
| **P95 Latency** | < 1,500 ms | **0.88 ms** | ✅ PASSED |

---

## 🔧 Agent Tools & Pydantic Schemas

### 1. `CalculateNSERiskTool`
- **Schema:** [`NSEPortfolioInput`](file:///home/tharun/projects/quant-copilot/apps/server/quant/schemas.py#L22)
- **Purpose:** Calculates vectorized risk metrics using 252 NSE trading days and INR portfolio figures.
- **Outputs:** Annualized return, annualized volatility, Sharpe ratio, Sortino ratio, Max Drawdown, 1-day 95% VaR in INR.

### 2. `FetchBSECorporateAnnouncements`
- **Schema:** `BSEAnnouncementsFilter`
- **Purpose:** Queries corporate announcements from BSE/NSE filings repository.
- **Outputs:** List of disclosures with filing dates, announcement categories (dividend, earnings, board meeting, AGM), and structured summaries.

### 3. `FetchMarketQuote`
- **Purpose:** Fetches current spot pricing with built-in rate-limit simulation.
- **Fallback Trigger:** If rate limit is triggered, automatically routes to `fallback_node` to serve cached Redis data stamped with `stale: true`.

---

## 🔒 Guardrails & Safety Interventions

Quant Copilot includes zero-tolerance guardrails against common LLM failures:
- **Mental Math Prohibited:** Any prompt demanding calculation without tools is intercepted with a refusal citing `Rule 1`.
- **Price Forecasting Prohibited:** Any prompt asking to predict future share prices or closing index levels is blocked under market risk compliance.
- **Unverified Order Mutation Blocked:** Rebalance recommendations remain strictly in a `pending` state until explicit human click verification.
