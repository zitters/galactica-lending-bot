// ═══════════════════════════════════════════════════════════════
// src/lifecycle/ReputationEmitter.ts — Intercom Signal Broadcaster
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// KILLER FEATURE: After every loan lifecycle event (repaid,
// defaulted, partial), this module broadcasts a cryptographically
// signed "Signal" to the Intercom Protocol.
//
// Other AI agents can read these signals to:
//   • Reward good borrowers with lower rates
//   • Warn against serial defaulters
//   • Build a decentralized credit graph on Bitcoin
// ═══════════════════════════════════════════════════════════════

import { IntercomProvider } from '@/data/IntercomProvider';
import { LoanRecord, IntercomSignal, LoanToken } from '@/types';
import Logger from '@/utils/logger';

export class ReputationEmitter {
  /**
   * Emit a REPAID signal — borrower paid back on time.
   */
  static async emitRepaid(loan: LoanRecord, txHash: string): Promise<boolean> {
    const signal: IntercomSignal = {
      agentId:    process.env.INTERCOM_AGENT_ID ?? 'galactica-lending-bot-v1',
      signalType: 'REPAID',
      loanAmount: loan.amount,
      token:      loan.token as LoanToken,
      timestamp:  Date.now(),
      message:    `✅ Loan of ${loan.amount} ${loan.token} repaid on time. Duration: ${loan.durationDays} days. Credit score at disbursement: ${loan.creditScore}/100.`,
      txHash,
    };

    Logger.success('[ReputationEmitter] Broadcasting REPAID signal', {
      address: loan.btcAddress,
      amount:  loan.amount,
      token:   loan.token,
    });

    return IntercomProvider.broadcastSignal(signal);
  }

  /**
   * Emit a DEFAULTED signal — borrower failed to repay.
   */
  static async emitDefaulted(loan: LoanRecord): Promise<boolean> {
    const daysOverdue = Math.floor((Date.now() - loan.dueAt) / 86400000);
    const outstanding = loan.totalRepayment - loan.amountRepaid;

    const signal: IntercomSignal = {
      agentId:    process.env.INTERCOM_AGENT_ID ?? 'galactica-lending-bot-v1',
      signalType: 'DEFAULTED',
      loanAmount: loan.amount,
      token:      loan.token as LoanToken,
      timestamp:  Date.now(),
      message:    `🚨 DEFAULT: Loan of ${loan.amount} ${loan.token} NOT repaid. Outstanding: ${outstanding.toFixed(2)} ${loan.token}. ${daysOverdue} days overdue. Address blacklisted.`,
    };

    Logger.warn('[ReputationEmitter] Broadcasting DEFAULTED signal', {
      address:    loan.btcAddress,
      outstanding,
      daysOverdue,
    });

    return IntercomProvider.broadcastSignal(signal);
  }

  /**
   * Emit a PARTIAL signal — borrower made partial payment.
   */
  static async emitPartial(loan: LoanRecord, partialAmount: number): Promise<boolean> {
    const signal: IntercomSignal = {
      agentId:    process.env.INTERCOM_AGENT_ID ?? 'galactica-lending-bot-v1',
      signalType: 'PARTIAL',
      loanAmount: loan.amount,
      token:      loan.token as LoanToken,
      timestamp:  Date.now(),
      message:    `⚠️ PARTIAL: ${partialAmount.toFixed(2)} of ${loan.totalRepayment.toFixed(2)} ${loan.token} repaid. Remaining: ${(loan.totalRepayment - partialAmount).toFixed(2)} ${loan.token}.`,
    };

    return IntercomProvider.broadcastSignal(signal);
  }
}

export default ReputationEmitter;
