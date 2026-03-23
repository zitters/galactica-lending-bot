// ═══════════════════════════════════════════════════════════════
// src/lifecycle/YieldOptimizer.ts — Idle Treasury Yield Management
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Bonus Feature: When the agent's idle treasury exceeds a threshold
// (default: $1,000), automatically stake idle funds into
// Tether-based yield protocols to maximize capital efficiency.
// ═══════════════════════════════════════════════════════════════

import { WDKClient }    from '@/wallet';
import { LocalStore }   from '@/db/LocalStore';
import { YieldPosition, LoanToken } from '@/types';
import Logger           from '@/utils/logger';

const YIELD_THRESHOLD = parseFloat(process.env.AGENT_YIELD_THRESHOLD ?? '1000');
const MIN_APY         = parseFloat(process.env.YIELD_MIN_APY         ?? '3.5');

export class YieldOptimizer {
  private static positions: YieldPosition[] = [];

  /**
   * Check if idle funds should be staked, and stake them if eligible.
   * Called by AgentLoop on each cycle.
   */
  static async optimize(): Promise<{
    action:   'STAKED' | 'NO_ACTION' | 'UNSTAKED';
    amount?:  number;
    token?:   LoanToken;
    reason:   string;
  }> {
    const balance     = await WDKClient.getBalance();
    const stats       = await LocalStore.getStats();

    // Estimate funds needed for active loans (buffer)
    const reserveNeeded = stats.activeLoans * 500; // $500 buffer per active loan
    const idleUSDt      = Math.max(0, balance.USDt - reserveNeeded);

    Logger.info('[YieldOptimizer] Checking idle treasury', {
      totalUSDt:   balance.USDt,
      reserveNeeded,
      idleUSDt,
      threshold:   YIELD_THRESHOLD,
    });

    if (idleUSDt < YIELD_THRESHOLD) {
      return {
        action: 'NO_ACTION',
        reason: `Idle funds (${idleUSDt.toFixed(2)} USDt) below threshold of ${YIELD_THRESHOLD} USDt. Keeping as lending liquidity.`,
      };
    }

    // ── Stake idle funds ─────────────────────────────────────
    const stakeAmount = Math.floor(idleUSDt * 0.8 * 100) / 100; // Stake 80%, keep 20% liquid

    Logger.info(`[YieldOptimizer] Staking ${stakeAmount} USDt into yield protocol`);

    const result = await WDKClient.stakeToYield(stakeAmount, 'USDt');

    if (result.success && result.position) {
      this.positions.push(result.position);
      Logger.success('[YieldOptimizer] Yield position opened', {
        amount: stakeAmount,
        apy:    result.position.apy,
      });
      return {
        action: 'STAKED',
        amount: stakeAmount,
        token:  'USDt',
        reason: `${stakeAmount} USDt staked at ${result.position.apy}% APY. Earning while idle!`,
      };
    }

    return {
      action: 'NO_ACTION',
      reason: `Staking failed: ${result.error ?? 'Unknown error'}`,
    };
  }

  /**
   * Calculate total yield earned across all positions.
   */
  static calculateTotalEarned(): number {
    return this.positions.reduce((sum, p) => {
      const daysHeld  = (Date.now() - p.enteredAt) / 86400000;
      const earned    = p.amount * (p.apy / 100) * (daysHeld / 365);
      return sum + earned;
    }, 0);
  }

  static getPositions(): YieldPosition[] {
    return [...this.positions];
  }

  static getTotalStaked(): number {
    return this.positions.reduce((s, p) => s + p.amount, 0);
  }
}

export default YieldOptimizer;
