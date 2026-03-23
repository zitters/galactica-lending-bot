// ═══════════════════════════════════════════════════════════════
// src/logic/InterAgentLending.ts — Agent-to-Agent Liquidity Network
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Bonus Feature: Agents can borrow from other agents to complete
// complex lending tasks when their treasury runs low.
//
// This creates a decentralized liquidity network where agents
// with excess capital can earn yield by lending to capital-constrained agents.
// ═══════════════════════════════════════════════════════════════

import { WDKClient } from '@/wallet';
import { LocalStore } from '@/db/LocalStore';
import { IntercomProvider } from '@/data/IntercomProvider';
import { LoanToken } from '@/types';
import Logger from '@/utils/logger';

interface AgentLiquidityOffer {
  agentId: string;
  token: LoanToken;
  amount: number;
  apr: number; // Inter-agent lending rate
  expiresAt: number;
}

interface InterAgentLoan {
  id: string;
  borrowedFrom: string;
  amount: number;
  token: LoanToken;
  apr: number;
  borrowedAt: number;
  dueAt: number;
  status: 'ACTIVE' | 'REPAID' | 'DEFAULTED';
}

export class InterAgentLending {
  private static activeLoans: InterAgentLoan[] = [];

  /**
   * Request liquidity from peer agents when treasury is low.
   */
  static async requestPeerLiquidity(
    amountNeeded: number,
    token: LoanToken
  ): Promise<{ success: boolean; amount?: number; agentId?: string; apr?: number }> {
    Logger.info('[InterAgent] Requesting liquidity from peer agents', { amountNeeded, token });

    // Check Intercom for peer agent liquidity offers
    const offers = await this.discoverPeerOffers(token);

    if (offers.length === 0) {
      Logger.warn('[InterAgent] No peer liquidity offers available');
      return { success: false };
    }

    // Find the best offer (lowest APR)
    const bestOffer = offers
      .filter(offer => offer.amount >= amountNeeded)
      .sort((a, b) => a.apr - b.apr)[0];

    if (!bestOffer) {
      Logger.warn('[InterAgent] No peer offers meet the amount requirement');
      return { success: false };
    }

    // Execute the inter-agent loan
    const result = await this.executeInterAgentLoan(bestOffer, amountNeeded);

    if (result.success) {
      Logger.success('[InterAgent] Successfully borrowed from peer agent', {
        from: bestOffer.agentId,
        amount: amountNeeded,
        apr: bestOffer.apr,
      });
    }

    return result;
  }

  /**
   * Discover liquidity offers from peer agents via Intercom.
   */
  private static async discoverPeerOffers(token: LoanToken): Promise<AgentLiquidityOffer[]> {
    // In demo mode, simulate peer offers
    if (process.env.DEMO_MODE === 'true') {
      const offers: AgentLiquidityOffer[] = [
        {
          agentId: 'agent-galactica-001',
          token,
          amount: 10000,
          apr: 8.5,
          expiresAt: Date.now() + 3600000, // 1 hour
        },
        {
          agentId: 'agent-stellar-002',
          token,
          amount: 25000,
          apr: 7.2,
          expiresAt: Date.now() + 3600000,
        },
      ];
      return offers.filter(offer => offer.token === token);
    }

    // In production, query Intercom for peer liquidity broadcasts
    try {
      const response = await IntercomProvider.queryPeerLiquidityOffers(token);
      return response.offers || [];
    } catch (err) {
      Logger.error('[InterAgent] Failed to query peer offers', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Execute an inter-agent loan by transferring funds.
   */
  private static async executeInterAgentLoan(
    offer: AgentLiquidityOffer,
    amount: number
  ): Promise<{ success: boolean; amount?: number; agentId?: string; apr?: number }> {
    try {
      // In demo mode, simulate the transfer
      if (process.env.DEMO_MODE === 'true') {
        // Simulate receiving funds
        const loan: InterAgentLoan = {
          id: `inter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          borrowedFrom: offer.agentId,
          amount,
          token: offer.token,
          apr: offer.apr,
          borrowedAt: Date.now(),
          dueAt: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
          status: 'ACTIVE',
        };

        this.activeLoans.push(loan);
        await LocalStore.saveInterAgentLoan(loan);

        return {
          success: true,
          amount,
          agentId: offer.agentId,
          apr: offer.apr,
        };
      }

      // In production, execute actual WDK transfer from peer agent
      // This would require coordination with the peer agent's WDK instance
      Logger.info('[InterAgent] Production inter-agent lending not yet implemented');
      return { success: false };

    } catch (err) {
      Logger.error('[InterAgent] Failed to execute inter-agent loan', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { success: false };
    }
  }

  /**
   * Repay an inter-agent loan using earned revenue.
   */
  static async repayInterAgentLoan(loanId: string): Promise<boolean> {
    const loan = this.activeLoans.find(l => l.id === loanId);
    if (!loan || loan.status !== 'ACTIVE') {
      return false;
    }

    try {
      // Calculate repayment amount (principal + interest)
      const daysBorrowed = (Date.now() - loan.borrowedAt) / (24 * 60 * 60 * 1000);
      const interest = (loan.amount * loan.apr * daysBorrowed) / 36500; // Daily interest
      const totalRepayment = loan.amount + interest;

      // Check if agent has sufficient funds
      const balance = await WDKClient.getBalance();
      const available = loan.token === 'USDt' ? balance.USDt : balance.XAUt;

      if (available < totalRepayment) {
        Logger.warn('[InterAgent] Insufficient funds to repay inter-agent loan', {
          loanId,
          needed: totalRepayment,
          available,
        });
        return false;
      }

      // Execute repayment transfer
      if (process.env.DEMO_MODE === 'true') {
        // Simulate repayment
        loan.status = 'REPAID';
        await LocalStore.updateInterAgentLoanStatus(loanId, 'REPAID');
        Logger.success('[InterAgent] Inter-agent loan repaid', { loanId, amount: totalRepayment });
        return true;
      }

      // Production: Transfer repayment to peer agent
      Logger.info('[InterAgent] Production repayment not yet implemented');
      return false;

    } catch (err) {
      Logger.error('[InterAgent] Failed to repay inter-agent loan', {
        loanId,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Get all active inter-agent loans.
   */
  static getActiveLoans(): InterAgentLoan[] {
    return this.activeLoans.filter(loan => loan.status === 'ACTIVE');
  }

  /**
   * Calculate total inter-agent debt.
   */
  static getTotalDebt(): number {
    return this.activeLoans
      .filter(loan => loan.status === 'ACTIVE')
      .reduce((sum, loan) => sum + loan.amount, 0);
  }

  /**
   * Broadcast liquidity offer to peer agents.
   */
  static async broadcastLiquidityOffer(
    token: LoanToken,
    amount: number,
    apr: number
  ): Promise<void> {
    const offer = {
      agentId: process.env.INTERCOM_AGENT_ID || 'galactica-lending-bot',
      token,
      amount,
      apr,
      timestamp: Date.now(),
    };

    if (process.env.DEMO_MODE === 'true') {
      Logger.info('[InterAgent] Broadcasting liquidity offer (demo)', offer);
      return;
    }

    // Production: Broadcast to Intercom network
    try {
      await IntercomProvider.broadcastLiquidityOffer(offer);
      Logger.info('[InterAgent] Liquidity offer broadcasted', offer);
    } catch (err) {
      Logger.error('[InterAgent] Failed to broadcast liquidity offer', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export default InterAgentLending;