# 🤖 GALACTICA LENDING BOT
## Autonomous AI Lending Agent | Galactica Hackathon 2026

> *Bridging Bitcoin identity with Tether-based lending through the Intercom Protocol's decentralized credit graph and WDK self-custodial settlement.*

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Track](https://img.shields.io/badge/Track-Lending%20Bot-purple)

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GALACTICA LENDING BOT                         │
│                                                                   │
│  USER (Bitcoin Wallet)                                            │
│       │                                                           │
│       │  BIP-137 Signed Message                                   │
│       ▼                                                           │
│  ┌──────────────┐   Auth Challenge      ┌──────────────────┐     │
│  │ ChallengeManager│◄──────────────────►│  BtcVerifier.ts  │     │
│  │  (UUID + Time) │                     │  (bitcoinjs-msg) │     │
│  └──────────────┘                       └──────────────────┘     │
│                                                  │                │
│                              Cryptographic Proof ▼                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              INTERCOM PROTOCOL (Trac Systems)              │   │
│  │                                                            │   │
│  │  IntercomProvider.ts                                       │   │
│  │  ├── BTC Balance & History (6-month window)               │   │
│  │  ├── TAP Protocol Token Balances ($TRAC, $NAT, ...)       │   │
│  │  └── Cross-Agent Reputation Signals (REPAID/DEFAULT)      │   │
│  └──────────────────────────┬─────────────────────────────── ┘   │
│                             │ CreditProfile object                │
│                             ▼                                     │
│  ┌──────────────────────────────────────────┐                    │
│  │            SCORING ENGINE                 │                    │
│  │  40% BTC Balance · 40% Activity History  │                    │
│  │  20% TAP Assets  · ±10 Reputation Bonus  │                    │
│  │  Score: 0–100 → Tier: LOW/MOD/HIGH/REJECT│                    │
│  └──────────────────────────┬───────────────┘                    │
│                             │                                     │
│                             ▼                                     │
│  ┌──────────────────────────────────────────┐                    │
│  │        ARIA — LLM NEGOTIATOR              │                    │
│  │  (OpenClaw × GPT-4o Risk Manager Persona) │                    │
│  │  Dynamic APR · Tenure Discounts · Offers  │                    │
│  └──────────────────────────┬───────────────┘                    │
│                             │ Terms ACCEPTED                      │
│                             ▼                                     │
│  ┌──────────────────────────────────────────┐                    │
│  │         WDK SETTLEMENT LAYER              │                    │
│  │  (Tether Wallet Dev Kit — Self-Custodial) │                    │
│  │  USD₮ Transfer · XAUt Transfer · Yield   │                    │
│  └──────────────────────────┬───────────────┘                    │
│                             │ TX Hash                             │
│                             ▼                                     │
│  ┌──────────────────────────────────────────┐                    │
│  │         REPUTATION LOOP                   │                    │
│  │  RepaymentWatcher → ReputationEmitter     │                    │
│  │  → Broadcast Signal to Intercom Protocol  │                    │
│  │  → Other agents receive credit update    │                    │
│  └───────────────────────────────────────── ┘                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🌟 The Core Innovation: How Intercom Solves the "Trust Problem"

### The Problem in AI Lending

Traditional DeFi lending relies on over-collateralization (borrow $70 to lock $100). This is capital-inefficient and excludes users without pre-existing crypto assets. Without a universal, verifiable identity and reputation layer, AI agents cannot make trust-based lending decisions.

### The Solution: Intercom Protocol as a Decentralized Credit Bureau

The **Intercom Protocol** by Trac Systems is a Bitcoin-native communication and data layer built on the **TAP Protocol**. In this project, we leverage Intercom as a **decentralized credit graph**:

1. **On-Chain Identity**: Every user's Bitcoin address has a verifiable history (balance, transaction count, account age) stored immutably on Bitcoin and indexed by Trac's indexers.

2. **TAP Token Reputation**: $TRAC and other TAP token holdings serve as proof of ecosystem participation — holders demonstrate commitment and receive premium lending rates.

3. **Cross-Agent Signals**: When our agent marks a loan as REPAID or DEFAULTED, it broadcasts a **Reputation Signal** to the Intercom broadcast channel. **Other lending agents can read these signals** — creating a decentralized, agent-to-agent credit reporting system without any central authority.

4. **Agent-to-Agent Liquidity**: When this agent's treasury is low, it can query Intercom to discover peer agents with excess liquidity and borrow from them, creating an autonomous liquidity network.

### Why This Is Revolutionary

```
Traditional System:          Galactica System:
  Credit Bureau (Equifax)  →  Intercom Protocol (Bitcoin-native)
  Bank Identity (KYC)      →  BIP-137 Signature (Cryptographic)
  Credit Score (FICO)      →  On-Chain Score (Transparent, Auditable)
  Interest Rate (Opaque)   →  LLM Negotiation (Explainable AI)
  Wire Transfer (T+2)      →  WDK Settlement (On-chain, instant)
```

---

## 🏗️ Project Structure

```
galactica-lending-bot/
├── src/
│   ├── core/
│   │   └── AgentLoop.ts          # 🧠 Main autonomous orchestrator
│   ├── auth/
│   │   ├── ChallengeManager.ts   # 🔑 UUID challenge generator
│   │   └── BtcVerifier.ts        # 🔐 BIP-137 signature verifier
│   ├── data/
│   │   └── IntercomProvider.ts   # 📡 Trac Intercom indexer client
│   ├── logic/
│   │   ├── ScoringEngine.ts      # 📊 0–100 credit calculator
│   │   └── Negotiator.ts         # 🤝 LLM-driven ARIA agent
│   ├── wallet/
│   │   └── WDKClient.ts          # 💸 WDK USD₮/XAUt transfers
│   ├── lifecycle/
│   │   ├── RepaymentWatcher.ts   # ⏱️  Cron-based payment scanner
│   │   ├── ReputationEmitter.ts  # 📣 Intercom signal broadcaster
│   │   └── YieldOptimizer.ts     # 📈 Idle fund yield management
│   ├── db/
│   │   └── LocalStore.ts         # 🗄️  lowdb JSON loan database
│   ├── types/
│   │   └── index.ts              # 📝 Shared TypeScript types
│   ├── utils/
│   │   ├── logger.ts             # 📋 Structured agent logger
│   │   └── helpers.ts            # 🛠️  Utility functions
│   ├── app/
│   │   ├── layout.tsx            # 🖥️  Next.js root layout
│   │   ├── page.tsx              # 🏠 Main page entry
│   │   ├── globals.css           # 🎨 Cyber-DeFi styles
│   │   └── api/                  # 🔌 REST API routes
│   │       ├── auth/
│   │       │   ├── challenge/route.ts
│   │       │   └── verify/route.ts
│   │       ├── agent/
│   │       │   ├── negotiate/route.ts
│   │       │   └── execute/route.ts
│   │       ├── wallet/
│   │       │   └── balance/route.ts
│   │       └── loans/
│   │           └── route.ts
│   └── ui/
│       └── LendingDashboard.tsx  # 🎮 5-Step interactive demo UI
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- (Optional) OpenAI API key for real LLM negotiation

### Installation

```bash
# Clone and install
git clone https://github.com/your-org/galactica-lending-bot.git
cd galactica-lending-bot
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local — the most important settings:
# DEMO_MODE=true (for hackathon demo)
# OPENAI_API_KEY=your_key (optional, for real AI negotiation)
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

### Run Agent Standalone (background watcher)

```bash
npm run agent:start    # Boot the full agent
npm run agent:watcher  # Run just the repayment watcher
```

---

## ⚙️ Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `DEMO_MODE` | Enable simulation (no real keys needed) | `true` |
| `OPENAI_API_KEY` | GPT-4o for real LLM negotiation | — |
| `WDK_API_KEY` | Tether Wallet Dev Kit credentials | — |
| `INTERCOM_INDEXER_URL` | Trac Systems indexer endpoint | `https://indexer.trac.network` |
| `AGENT_TREASURY_USDT` | Starting USDt balance (demo) | `50000` |
| `AGENT_SCAN_INTERVAL_MINUTES` | Repayment check frequency | `5` |
| `AGENT_YIELD_THRESHOLD` | Min idle funds for yield staking | `1000` |

---

## 📊 Credit Scoring Model

```
Score = Balance(40%) + Activity(40%) + Assets(20%) ± Reputation(±10)

Balance Score (0–40):
  ≥5.00 BTC → 40pts | ≥2.00 BTC → 35pts | ≥1.00 BTC → 30pts
  ≥0.50 BTC → 24pts | ≥0.20 BTC → 18pts | ≥0.10 BTC → 12pts

Activity Score (0–40):
  TX count (0–20pts) + Account age (0–10pts) + 6m recency (0–10pts)

Asset Score (0–20):
  $TRAC holders: up to 12pts premium
  Other TAP tokens: up to 8pts

Reputation Bonus (±10):
  +3 per REPAID signal | +2 TRUSTED signal
  -1 PARTIAL | -5 DEFAULTED

Risk Tiers:
  85–100: LOW      → APR 3–6%   | Max $5,000 USDt
  60–84:  MODERATE → APR 10–14% | Max $1,000 USDt
  40–59:  HIGH     → APR 18–24% | Max $300 USDt
  0–39:   REJECT   → No loan
```

---

## 🔐 Security Model

### Self-Custodial Architecture
- **Private keys NEVER leave the server environment** — stored only in `.env`
- WDK handles key management with hardware-grade security
- No database stores sensitive key material

### Identity Security
- **BIP-137**: Each loan requires a fresh, time-bound (5 min) signing challenge
- **Replay protection**: Challenges are single-use and consumed on verification
- **Address binding**: Signature must match the exact challenge issued to that address

### Audit Trail
- Every agent decision is logged with timestamp and reasoning
- Loan records stored with full reasoning chain
- All Intercom signals are immutably broadcast on-chain

---

## ⚠️ Known Limitations

| Limitation | Mitigation |
|------------|------------|
| **Indexer Dependency**: Credit scoring speed depends on Trac indexer latency | Cache profiles for 1hr, fallback to minimal score |
| **LLM Non-Determinism**: GPT-4o can generate varied offers | Hard caps enforce max loan/APR limits at code level |
| **No BTC Collateral Custody**: Agent cannot seize BTC collateral | Future: HTLC-based collateral locking |
| **Demo Mode Gap**: Real WDK API not tested in Hackathon | Full integration ready, switch `DEMO_MODE=false` |
| **Single-Agent Treasury**: No pooled liquidity protocol | Agent-to-Agent Intercom liquidity requests (bonus feature) |

---

## 🎯 Hackathon Innovations

### 1. Bitcoin as Credit Identity
Instead of usernames/passwords or Web3 wallets, we use Bitcoin's existing public key infrastructure for identity. The signature proves control of real Bitcoin wealth.

### 2. Intercom as Decentralized Equifax
The Trac Intercom Protocol becomes a permissionless, Bitcoin-native credit bureau. Any agent can query any address's on-chain history and read peer signals.

### 3. ARIA — Explainable AI Lending
Every rate and decision is explained using actual on-chain data. "I'm offering 5% because your Intercom profile shows 2.5 BTC held for 72 months with 1 positive repayment signal."

### 4. Agent-to-Agent Economy
When liquidity is low, our agent can borrow from peer agents via Intercom — creating an autonomous, self-balancing lending economy with no human intervention.

### 5. Reputation Loop
The most powerful feature: after every loan outcome, a signed reputation signal is broadcast to Intercom. Over time, this builds an immutable, agent-readable credit history on Bitcoin.

---

## 📡 API Reference

```
POST /api/auth/challenge    — Generate BIP-137 signing challenge
POST /api/auth/verify       — Verify signature + run Intercom scoring
POST /api/agent/negotiate   — Start/continue LLM negotiation
POST /api/agent/execute     — Trigger WDK settlement
GET  /api/wallet/balance    — Agent treasury status
GET  /api/loans             — List all loans
```

---

## 📜 License

MIT License — Built for Galactica Hackathon 2026.

---

*Built with ❤️ by the Galactica Team · Powered by Bitcoin · Secured by Cryptography · Governed by Code*
