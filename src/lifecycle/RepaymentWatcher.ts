// ═══════════════════════════════════════════════════════════════
// src/lifecycle/RepaymentWatcher.ts — Autonomous Repayment Scanner
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Runs on a cron schedule (default: every 5 minutes).
// Scans the agent's WDK wallet for incoming transactions
// and matches them to active loans.
// Handles: on-time repayment, partial payment, default/liquidation.
// ═══════════════════════════════════════════════════════════════

import cron      from 'node-cron';
import { WDKClient }         from '@/wallet/WDKClient';
import { LocalStore }        from '@/db/LocalStore';
import { ReputationEmitter } from './ReputationEmitter';
import { LoanRecord }        from '@/types';
import Logger                from '@/utils/logger';

const SCAN_INTERVAL_MINUTES = parseInt(
  process.env.AGENT_SCAN_INTERVAL_MINUTES ?? '5', 10
);
const GRACE_PERIOD_DAYS = parseInt(
  process.env.REPAYMENT_GRACE_DAYS ?? '3', 10
);
const LIQUIDATION_THRESHOLD = parseFloat(
  process.env.LOAN_LIQUIDATION_LTV ?? '0.85'
);

let lastScanTimestamp = Date.now() - SCAN_INTERVAL_MINUTES * 60 * 1000;
let isWatcherRunning  = false;

export class RepaymentWatcher {
  private static cronJob: ReturnType<typeof cron.schedule> | null = null;

  /**
   * Start the repayment watcher cron job.
   */
  static start(): void {
    if (isWatcherRunning) {
      Logger.warn('[Watcher] Already running');
      return;
    }

    Logger.info(`[Watcher] Starting repayment watcher (every ${SCAN_INTERVAL_MINUTES}m)`);

    this.cronJob = cron.schedule(
      `*/${SCAN_INTERVAL_MINUTES} * * * *`,
      () => this.scan(),
      { scheduled: true }
    );

    isWatcherRunning = true;
    Logger.success('[Watcher] Repayment watcher is live');
  }

  static stop(): void {
    this.cronJob?.stop();
    isWatcherRunning = false;
    Logger.info('[Watcher] Stopped');
  }

  /**
   * Manual scan trigger (also called by cron).
   */
  static async scan(): Promise<{
    matched: number;
    overdue:  number;
    liquidated: number;
  }> {
    Logger.info('[Watcher] 🔍 Scanning wallet for repayments...');
    const results = { matched: 0, overdue: 0, liquidated: 0 };

    try {
      // ── Step 1: Fetch new incoming transactions ────────────
      const incomingTxs = await WDKClient.scanIncomingTx(lastScanTimestamp);
      lastScanTimestamp  = Date.now();

      // ── Step 2: Get all active loans ──────────────────────
      const activeLoans = await LocalStore.getAllActiveLoans();

      if (activeLoans.length === 0) {
        Logger.info('[Watcher] No active loans to monitor');
        return results;
      }

      Logger.info(`[Watcher] Monitoring ${activeLoans.length} active loan(s), ${incomingTxs.length} new incoming tx(s)`);

      // ── Step 3: Match transactions to loans ───────────────
      for (const tx of incomingTxs) {
        const matchedLoan = activeLoans.find(
          loan =>
            loan.btcAddress === tx.from &&
            loan.token       === tx.token &&
            Math.abs(tx.amount - loan.totalRepayment) < 1.0 // $1 tolerance
        );

        if (matchedLoan) {
          await this.handleRepayment(matchedLoan, tx.txHash, tx.amount);
          results.matched++;
        } else {
          Logger.info('[Watcher] Incoming TX not matched to loan', {
            from:   tx.from,
            amount: tx.amount,
            token:  tx.token,
          });
        }
      }

      // ── Step 4: Check for overdue / liquidation ───────────
      const now = Date.now();
      for (const loan of activeLoans) {
        const graceDue = loan.dueAt + GRACE_PERIOD_DAYS * 86400000;

        if (now > graceDue) {
          // Past grace period → liquidate
          await this.handleLiquidation(loan);
          results.liquidated++;
        } else if (now > loan.dueAt) {
          // Overdue but within grace period
          Logger.warn('[Watcher] Loan overdue (in grace period)', {
            loanId:    loan.id,
            btcAddr:   loan.btcAddress,
            daysOverdue: Math.floor((now - loan.dueAt) / 86400000),
          });
          results.overdue++;
        }
      }
    } catch (err) {
      Logger.error('[Watcher] Scan failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (results.matched + results.overdue + results.liquidated > 0) {
      Logger.info('[Watcher] Scan complete', results);
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Event Handlers
  // ─────────────────────────────────────────────────────────────

  private static async handleRepayment(
    loan: LoanRecord,
    txHash: string,
    amount: number
  ): Promise<void> {
    Logger.success('[Watcher] ✅ Repayment detected', {
      loanId: loan.id,
      amount,
      txHash,
    });

    await LocalStore.updateLoanStatus(loan.id, 'REPAID', {
      amountRepaid:     amount,
      txHashRepayment:  txHash,
    });

    // Broadcast positive reputation signal to Intercom
    await ReputationEmitter.emitRepaid(loan, txHash);
  }

  private static async handleLiquidation(loan: LoanRecord): Promise<void> {
    const daysOverdue = Math.floor((Date.now() - loan.dueAt) / 86400000);

    Logger.warn('[Watcher] 🚨 Loan defaulted — initiating liquidation', {
      loanId:     loan.id,
      btcAddress: loan.btcAddress,
      daysOverdue,
      outstanding: loan.totalRepayment - loan.amountRepaid,
    });

    await LocalStore.updateLoanStatus(loan.id, 'LIQUIDATED');
    await LocalStore.addToBlacklist(loan.btcAddress);

    // Broadcast negative reputation signal to Intercom
    await ReputationEmitter.emitDefaulted(loan);
  }
}

// ── Standalone execution ──────────────────────────────────────
if (require.main === module) {
  RepaymentWatcher.start();
  Logger.success('[Watcher] Running standalone repayment watcher');
}

export default RepaymentWatcher;
