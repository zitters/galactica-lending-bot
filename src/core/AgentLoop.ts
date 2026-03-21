// ═══════════════════════════════════════════════════════════════
// src/core/AgentLoop.ts — The Heart: Autonomous Agent Orchestrator
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// OpenClaw-style autonomous decision loop that orchestrates
// all agent components into a cohesive lending machine.
//
// Flow:
//   1. Verify BTC identity (BIP-137 signature)
//   2. Fetch Intercom profile
//   3. Score creditworthiness
//   4. Negotiate loan terms via LLM
//   5. Execute settlement via WDK
//   6. Monitor lifecycle & broadcast reputation
// ═══════════════════════════════════════════════════════════════

import { BtcVerifier }       from '@/auth/BtcVerifier';
import { ChallengeManager }  from '@/auth/ChallengeManager';
import { IntercomProvider }  from '@/data/IntercomProvider';
import { ScoringEngine }     from '@/logic/ScoringEngine';
import { Negotiator }        from '@/logic/Negotiator';
import { WDKClient }         from '@/wallet/WDKClient';
import { LocalStore }        from '@/db/LocalStore';
import { RepaymentWatcher }  from '@/lifecycle/RepaymentWatcher';
import { YieldOptimizer }    from '@/lifecycle/YieldOptimizer';
import {
  AgentState,
  CreditProfile,
  LoanToken,
  LoanOffer,
  APIResponse,
} from '@/types';
import Logger from '@/utils/logger';

let agentState: AgentState = {
  isRunning:      false,
  lastScan:       0,
  activeLoans:    0,
  totalDisbursed: 0,
  totalRepaid:    0,
  walletBalance:  { USDt: 0, XAUt: 0, lastUpdated: 0 },
  yieldPositions: [],
  agentLog:       [],
};

export class AgentLoop {
  // ─────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Boot the agent: load state, start watchers, run initial scan.
   */
  static async initialize(): Promise<void> {
    Logger.info('╔════════════════════════════════════════╗');
    Logger.info('║  GALACTICA LENDING BOT — AGENT BOOT   ║');
    Logger.info('╚════════════════════════════════════════╝');

    agentState.isRunning = true;

    // Load wallet balance
    agentState.walletBalance = await WDKClient.getBalance();
    Logger.info('[Agent] Treasury loaded', {
      USDt: agentState.walletBalance.USDt,
      XAUt: agentState.walletBalance.XAUt,
    });

    // Load existing loan stats
    const stats = await LocalStore.getStats();
    agentState.activeLoans    = stats.activeLoans;
    agentState.totalDisbursed = stats.totalDisbursed;
    agentState.totalRepaid    = stats.totalRepaid;

    // Start repayment watcher
    RepaymentWatcher.start();

    // Initial yield optimization check
    await this.runYieldOptimization();

    Logger.success('[Agent] Initialization complete. Agent is live.');
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 1 & 2: IDENTITY + INTERCOM
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate an auth challenge for a Bitcoin address.
   */
  static generateChallenge(btcAddress: string) {
    Logger.info('[Agent] Generating auth challenge', { btcAddress });
    return ChallengeManager.generate(btcAddress);
  }

  /**
   * Verify a signed challenge and return credit profile if valid.
   * This is the gateway — no profile is fetched without verification.
   */
  static async verifyAndScore(
    btcAddress: string,
    signature: string,
    challengeId: string
  ): Promise<APIResponse<{ creditProfile: CreditProfile; scanLogs: string[] }>> {
    const scanLogs: string[] = [];

    // ── Identity Verification ─────────────────────────────────
    scanLogs.push('[AUTH] Verifying BIP-137 signature...');
    const verification = await BtcVerifier.verify(btcAddress, signature, challengeId);

    if (!verification.verified) {
      Logger.error('[Agent] Identity verification FAILED', { btcAddress });
      return {
        success:   false,
        error:     verification.error ?? 'Signature verification failed',
        timestamp: Date.now(),
      };
    }
    scanLogs.push(`[AUTH] ✅ Identity confirmed for ${btcAddress}`);

    // ── Blacklist check ───────────────────────────────────────
    const isBlacklisted = await LocalStore.isBlacklisted(btcAddress);
    if (isBlacklisted) {
      Logger.warn('[Agent] Blacklisted address attempted loan', { btcAddress });
      return {
        success:   false,
        error:     'This address has been blacklisted due to a previous default.',
        timestamp: Date.now(),
      };
    }

    // ── Intercom Data Fetch ───────────────────────────────────
    scanLogs.push('[INTERCOM] Accessing Trac Indexers...');
    const profile = await IntercomProvider.getProfile(btcAddress);

    scanLogs.push(`[INTERCOM] ${profile.txCount.toLocaleString()} BTC transactions found.`);
    scanLogs.push(`[INTERCOM] Balance: ${profile.btcBalance.toFixed(4)} BTC ($${profile.btcBalanceUSD.toLocaleString()})`);
    scanLogs.push(`[INTERCOM] Account age: ${profile.accountAgeMonths} months`);
    scanLogs.push(`[INTERCOM] TAP tokens: ${profile.tapTokens.map(t => `${t.amount.toLocaleString()} ${t.ticker}`).join(', ') || 'None'}`);
    scanLogs.push(`[INTERCOM] Reputation signals: ${profile.signals.length}`);

    // ── Credit Scoring ────────────────────────────────────────
    scanLogs.push('[AI] Running credit scoring algorithm...');
    const creditProfile = ScoringEngine.calculate(profile);

    scanLogs.push(`[AI] Risk score calculated: ${creditProfile.score}/100 (${creditProfile.tier})`);
    scanLogs.push(`[AI] APR range: ${creditProfile.aprRange[0]}–${creditProfile.aprRange[1]}%`);
    scanLogs.push(`[AI] Max loan eligible: $${creditProfile.maxLoanUSDt.toLocaleString()} USDt`);

    if (creditProfile.tier === 'REJECT') {
      scanLogs.push('[AI] ❌ Score below minimum threshold. Loan rejected.');
      return {
        success:   false,
        data:      { creditProfile, scanLogs },
        error:     'Credit score too low. Minimum score of 40 required.',
        reasoning: creditProfile.reasoning,
        timestamp: Date.now(),
      };
    }

    Logger.success('[Agent] Verification + scoring complete', {
      btcAddress,
      score: creditProfile.score,
      tier:  creditProfile.tier,
    });

    return {
      success:   true,
      data:      { creditProfile, scanLogs },
      reasoning: creditProfile.reasoning,
      timestamp: Date.now(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3: NEGOTIATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Start a loan negotiation session.
   */
  static async startNegotiation(
    creditProfile: CreditProfile,
    amount: number,
    token: LoanToken,
    durationDays: number
  ): Promise<APIResponse<{ sessionId: string; message: string; offer?: LoanOffer }>> {
    // Check liquidity
    const balance   = await WDKClient.getBalance();
    const available = token === 'USDt' ? balance.USDt : balance.XAUt;

    if (available < amount) {
      Logger.warn('[Agent] Insufficient liquidity', { required: amount, available, token });

      // In demo mode, bypass liquidity check and proceed
      if (process.env.DEMO_MODE !== 'true') {
        // Try to borrow from peer agents (only in production mode)
        const peerLiquidity = await IntercomProvider.requestLiquidityFromPeers(amount, token);
        if (peerLiquidity.available) {
          Logger.info(`[Agent] Borrowing liquidity from ${peerLiquidity.agentId} via Intercom`);
        } else {
          return {
            success:   false,
            error:     `Liquidity Exhausted. Agent treasury has insufficient ${token}. Please try a smaller amount or check back later.`,
            timestamp: Date.now(),
          };
        }
      } else {
        // Demo mode: allow loan to proceed regardless of balance
        Logger.info('[Agent] DEMO mode — Bypassing peer liquidity request');
      }
    }

    const result = await Negotiator.startSession(creditProfile, amount, token, durationDays);

    return {
      success:   true,
      data:      result,
      timestamp: Date.now(),
    };
  }

  /**
   * Continue a negotiation session.
   */
  static async continueNegotiation(
    sessionId: string,
    userMessage: string
  ): Promise<APIResponse<{ message: string; offer?: LoanOffer; status: string }>> {
    const result = await Negotiator.chat(sessionId, userMessage);
    return {
      success:   true,
      data:      { message: result.message, offer: result.offer, status: result.status },
      timestamp: Date.now(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4: WDK SETTLEMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Execute the loan disbursement after terms are accepted.
   */
  static async executeLoan(
    sessionId: string
  ): Promise<APIResponse<{ txHash: string; explorerUrl: string; loanId: string }>> {
    const session = Negotiator.getSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session not found', timestamp: Date.now() };
    }
    if (session.status !== 'ACCEPTED') {
      return { success: false, error: 'Terms not yet accepted', timestamp: Date.now() };
    }

    const offer = session.currentOffer!;
    Logger.info('[Agent] Executing loan via WDK', {
      btcAddress: session.btcAddress,
      amount:     offer.amount,
      token:      offer.token,
    });

    // ── WDK Transfer ──────────────────────────────────────────
    const transfer = await WDKClient.sendFunds({
      recipientAddress: session.btcAddress,
      amount:           offer.amount,
      token:            offer.token,
      memo:             `GalacticaLoan:${sessionId}`,
      loanId:           sessionId,
    });

    if (!transfer.success) {
      Logger.error('[Agent] WDK transfer failed', { error: transfer.error });
      return {
        success:   false,
        error:     transfer.error ?? 'Transfer failed',
        timestamp: Date.now(),
      };
    }

    // ── Save to DB ────────────────────────────────────────────
    const loan = await LocalStore.saveLoan(
      session.btcAddress,
      offer.amount,
      offer.token,
      offer.aprPercent,
      offer.durationDays,
      offer.totalRepayment,
      transfer.txHash!,
      session.creditProfile.score,
      session.creditProfile.reasoning
    );

    // Update agent state
    agentState.activeLoans++;
    agentState.totalDisbursed += offer.amount;
    agentState.walletBalance   = await WDKClient.getBalance();

    Logger.success('[Agent] 💰 Loan disbursed successfully!', {
      loanId:  loan.id,
      txHash:  transfer.txHash,
      amount:  `${offer.amount} ${offer.token}`,
    });

    return {
      success:   true,
      data:      {
        txHash:      transfer.txHash!,
        explorerUrl: transfer.explorerUrl!,
        loanId:      loan.id,
      },
      reasoning: `Loan approved. Intercom profile showed ${session.creditProfile.score}/100 score with stable holdings.`,
      timestamp: Date.now(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // BACKGROUND TASKS
  // ─────────────────────────────────────────────────────────────

  static async runYieldOptimization(): Promise<void> {
    const result = await YieldOptimizer.optimize();
    Logger.info('[Agent] Yield optimization result', { action: result.action, reason: result.reason });

    if (result.action === 'STAKED') {
      Logger.success(`[Agent] 📈 ${result.amount} ${result.token} staked for yield`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────

  static getState(): AgentState {
    return { ...agentState };
  }

  static async refreshState(): Promise<AgentState> {
    agentState.walletBalance = await WDKClient.getBalance();
    const stats = await LocalStore.getStats();
    agentState.activeLoans    = stats.activeLoans;
    agentState.totalDisbursed = stats.totalDisbursed;
    agentState.totalRepaid    = stats.totalRepaid;
    agentState.yieldPositions = YieldOptimizer.getPositions();
    agentState.agentLog       = Logger.getLogs().slice(-50);
    return { ...agentState };
  }
}

// ── Standalone boot ───────────────────────────────────────────
if (require.main === module) {
  AgentLoop.initialize().catch(err => {
    Logger.error('[Agent] Fatal boot error', { error: String(err) });
    process.exit(1);
  });
}

export default AgentLoop;
