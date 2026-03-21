// ═══════════════════════════════════════════════════════════════
// src/types/index.ts — Shared TypeScript Types & Interfaces
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════

export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'REJECT';
export type LoanStatus = 'PENDING' | 'ACTIVE' | 'REPAID' | 'DEFAULTED' | 'LIQUIDATED';
export type LoanToken = 'USDt' | 'XAUt';
export type NetworkType = 'mainnet' | 'testnet' | 'regtest';

// ── Auth & Identity ───────────────────────────────────────────
export interface AuthChallenge {
  id: string;
  message: string;
  btcAddress: string;
  issuedAt: number;
  expiresAt: number;
  used: boolean;
}

export interface VerificationResult {
  verified: boolean;
  btcAddress: string;
  challenge: string;
  signature: string;
  timestamp: number;
  error?: string;
}

// ── Intercom Protocol Data ────────────────────────────────────
export interface IntercomBTCProfile {
  address: string;
  btcBalance: number;          // in BTC
  btcBalanceUSD: number;       // in USD
  txCount: number;             // total transactions
  txLast6Months: number;       // transactions in last 6 months
  firstSeenTimestamp: number;  // Unix timestamp of first tx
  lastSeenTimestamp: number;   // Unix timestamp of last tx
  accountAgeMonths: number;    // derived age
  tapTokens: TAPTokenBalance[];
  totalValueUSD: number;
  isBlacklisted: boolean;
  signals: IntercomSignal[];   // reputation signals from other agents
}

export interface TAPTokenBalance {
  ticker: string;
  amount: number;
  usdValue?: number;
  contractId?: string;
}

export interface IntercomSignal {
  agentId: string;
  signalType: 'REPAID' | 'DEFAULTED' | 'PARTIAL' | 'TRUSTED';
  loanAmount: number;
  token: LoanToken;
  timestamp: number;
  message: string;
  txHash?: string;
}

// ── Credit Scoring ────────────────────────────────────────────
export interface CreditProfile {
  btcAddress: string;
  score: number;               // 0–100
  tier: RiskTier;
  breakdown: ScoreBreakdown;
  maxLoanUSDt: number;
  aprRange: [number, number];  // [min, max] %
  reasoning: string;
  calculatedAt: number;
}

export interface ScoreBreakdown {
  balanceScore: number;        // 0–40 points
  activityScore: number;       // 0–40 points
  assetScore: number;          // 0–20 points
  reputationBonus: number;     // ±10 points from Intercom signals
  total: number;
}

// ── Loan Negotiation ─────────────────────────────────────────
export interface NegotiationContext {
  sessionId: string;
  btcAddress: string;
  creditProfile: CreditProfile;
  requestedAmount: number;
  requestedToken: LoanToken;
  requestedDurationDays: number;
  messages: ChatMessage[];
  currentOffer?: LoanOffer;
  negotiationRound: number;
  status: 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface LoanOffer {
  sessionId: string;
  amount: number;
  token: LoanToken;
  aprPercent: number;
  durationDays: number;
  totalRepayment: number;
  dailyRepayment: number;
  expiresAt: number;
  reasoning: string;
}

// ── WDK Wallet & Transactions ─────────────────────────────────
export interface WDKTransferRequest {
  recipientAddress: string;
  amount: number;
  token: LoanToken;
  memo?: string;
  loanId?: string;
}

export interface WDKTransferResult {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  amount: number;
  token: LoanToken;
  fee: number;
  timestamp: number;
  error?: string;
  ethAddress?: string;        // ETH address where funds were sent (or will be sent)
  collateralRequired?: number; // BTC collateral requirement
}

export interface WalletBalance {
  USDt: number;
  XAUt: number;
  lastUpdated: number;
}

// ── Loan Record (DB) ─────────────────────────────────────────
export interface LoanRecord {
  id: string;
  btcAddress: string;
  amount: number;
  token: LoanToken;
  aprPercent: number;
  durationDays: number;
  totalRepayment: number;
  disbursedAt: number;
  dueAt: number;
  status: LoanStatus;
  txHashDisbursement: string;
  txHashRepayment?: string;
  amountRepaid: number;
  creditScore: number;
  reasoning: string;
  agentReasoningLog: string[];
  // ── Collateral Escrow ─────
  collateralWBTC?: number;         // Amount locked in smart contract
  collateralContractAddress?: string; // Address of escrow contract
  collateralLockTxHash?: string;   // TX where collateral was locked
  collateralReleaseReason?: string; // "repaid", "defaulted", "cancelled"
  collateralReleasedAt?: number;   // When collateral was released
}

// ── Yield Management ─────────────────────────────────────────
export interface YieldPosition {
  poolAddress: string;
  amount: number;
  token: LoanToken;
  apy: number;
  enteredAt: number;
  currentValue: number;
  earned: number;
}

// ── Agent State ───────────────────────────────────────────────
export interface AgentState {
  isRunning: boolean;
  lastScan: number;
  activeLoans: number;
  totalDisbursed: number;
  totalRepaid: number;
  walletBalance: WalletBalance;
  yieldPositions: YieldPosition[];
  agentLog: AgentLogEntry[];
}

export interface AgentLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DECISION';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

// ── API Response Shapes ───────────────────────────────────────
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  reasoning?: string;
  timestamp: number;
}
