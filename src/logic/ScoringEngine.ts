// ═══════════════════════════════════════════════════════════════
// src/logic/ScoringEngine.ts — AI Credit Scoring Engine
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Translates on-chain Bitcoin + TAP data from Intercom into a
// deterministic Credit Score (0–100) with full reasoning.
//
// Weight Matrix:
//   40% — Bitcoin Balance & Value
//   40% — Transaction History & Activity  
//   20% — TAP Token Holdings ($TRAC premium)
//   ±10 — Intercom Reputation Bonus/Penalty
// ═══════════════════════════════════════════════════════════════

import {
  IntercomBTCProfile,
  CreditProfile,
  RiskTier,
  ScoreBreakdown,
} from '@/types';
import {
  getAPRFromTier,
  getMaxLoanFromTier,
} from '@/utils/helpers';
import { DefaultPredictor } from './DefaultPredictor';
import Logger from '@/utils/logger';

// ── Scoring Thresholds ────────────────────────────────────────
const SCORE_TIER: Record<RiskTier, { min: number; max: number }> = {
  LOW:      { min: 85, max: 100 },
  MODERATE: { min: 60, max: 84  },
  HIGH:     { min: 40, max: 59  },
  REJECT:   { min: 0,  max: 39  },
};

// ── Balance Score (0–40 pts) ──────────────────────────────────
const BALANCE_TIERS = [
  { minBTC: 5.00, points: 40 },
  { minBTC: 2.00, points: 35 },
  { minBTC: 1.00, points: 30 },
  { minBTC: 0.50, points: 24 },
  { minBTC: 0.20, points: 18 },
  { minBTC: 0.10, points: 12 },
  { minBTC: 0.05, points: 8  },
  { minBTC: 0.01, points: 4  },
  { minBTC: 0.00, points: 1  },
];

// ── Activity Score (0–40 pts) ─────────────────────────────────
// Weighted by tx count, age, and recency
const TX_SCORE_TIERS = [
  { minTx: 1000, points: 20 },
  { minTx: 500,  points: 17 },
  { minTx: 200,  points: 14 },
  { minTx: 100,  points: 11 },
  { minTx: 50,   points: 8  },
  { minTx: 20,   points: 5  },
  { minTx: 5,    points: 2  },
  { minTx: 0,    points: 0  },
];

export class ScoringEngine {
  /**
   * Main entry point: compute a CreditProfile from on-chain data.
   */
  static async calculate(profile: IntercomBTCProfile): Promise<CreditProfile> {
    Logger.info('[ScoringEngine] Calculating credit score', { address: profile.address });

    const balanceScore   = this.scoreBalance(profile.btcBalance);
    const activityScore  = this.scoreActivity(
      profile.txCount,
      profile.txLast6Months,
      profile.accountAgeMonths
    );
    const assetScore      = this.scoreAssets(profile.tapTokens);
    const reputationBonus = this.scoreReputation(profile.signals);

    const rawScore = balanceScore + activityScore + assetScore + reputationBonus;
    const score    = Math.max(0, Math.min(100, Math.round(rawScore)));

    const breakdown: ScoreBreakdown = {
      balanceScore,
      activityScore,
      assetScore,
      reputationBonus,
      total: score,
    };

    const tier       = this.getTier(score);
    const aprRange   = getAPRFromTier(tier);
    const maxLoan    = getMaxLoanFromTier(tier);

    // ML-based default prediction (bonus feature)
    const defaultRisk = await DefaultPredictor.predictDefaultProbability(
      { btcAddress: profile.address, score, tier, breakdown, maxLoanUSDt: maxLoan, aprRange, reasoning: '', calculatedAt: Date.now() },
      maxLoan * 0.5, // Assume average loan amount
      aprRange[0],   // Base APR
      30            // 30-day loan
    );

    const reasoning  = this.buildReasoning(profile, breakdown, tier, defaultRisk);

    const creditProfile: CreditProfile = {
      btcAddress:   profile.address,
      score,
      tier,
      breakdown,
      maxLoanUSDt:  maxLoan,
      aprRange,
      reasoning,
      calculatedAt: Date.now(),
    };

    Logger.decision(`Credit score: ${score}/100 (${tier})`, {
      address:     profile.address,
      score,
      tier,
      maxLoan,
      apr:         `${aprRange[0]}–${aprRange[1]}%`,
      breakdown,
    });

    return creditProfile;
  }

  // ─────────────────────────────────────────────────────────────
  // SCORING COMPONENTS
  // ─────────────────────────────────────────────────────────────

  /** 40% weight: Bitcoin balance */
  private static scoreBalance(btcBalance: number): number {
    const tier = BALANCE_TIERS.find(t => btcBalance >= t.minBTC);
    return tier?.points ?? 1;
  }

  /** 40% weight: Transaction history & activity */
  private static scoreActivity(
    txCount: number,
    txLast6Months: number,
    accountAgeMonths: number
  ): number {
    // Base from total tx count (0–20 pts)
    const txTier   = TX_SCORE_TIERS.find(t => txCount >= t.minTx);
    let txScore    = txTier?.points ?? 0;

    // Age bonus (0–10 pts): older accounts are more reliable
    const ageBonus = Math.min(10, Math.floor(accountAgeMonths / 6));

    // Recency bonus (0–10 pts): active in last 6 months
    const recencyRatio  = txCount > 0 ? txLast6Months / txCount : 0;
    const recencyBonus  = Math.round(recencyRatio * 10);

    return Math.min(40, txScore + ageBonus + recencyBonus);
  }

  /** 20% weight: TAP token holdings */
  private static scoreAssets(tapTokens: Array<{ ticker: string; amount: number; usdValue?: number }>): number {
    let score = 0;

    for (const token of tapTokens) {
      const ticker = token.ticker.toUpperCase();
      const usd    = token.usdValue ?? 0;

      if (ticker === 'TRAC') {
        // $TRAC holders get premium scoring (up to 12 pts)
        if (usd > 2000)     score += 12;
        else if (usd > 1000) score += 9;
        else if (usd > 500)  score += 6;
        else if (usd > 100)  score += 3;
        else                 score += 1;
      } else {
        // Other TAP tokens (up to 8 pts)
        if (usd > 1000)     score += 8;
        else if (usd > 500)  score += 5;
        else if (usd > 100)  score += 3;
        else if (usd > 0)    score += 1;
      }
    }

    return Math.min(20, score);
  }

  /** ±10 reputation modifier from Intercom peer signals */
  private static scoreReputation(signals: IntercomBTCProfile['signals']): number {
    if (!signals || signals.length === 0) return 0;

    let bonus = 0;
    for (const sig of signals) {
      switch (sig.signalType) {
        case 'REPAID':   bonus += 3;  break;  // +3 per successful repayment
        case 'TRUSTED':  bonus += 2;  break;  // +2 from trusted agent vouching
        case 'PARTIAL':  bonus -= 1;  break;  // -1 for partial defaults
        case 'DEFAULTED': bonus -= 5; break;  // -5 for default
      }
    }

    return Math.max(-10, Math.min(10, bonus));
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private static getTier(score: number): RiskTier {
    for (const [tier, range] of Object.entries(SCORE_TIER) as [RiskTier, { min: number; max: number }][]) {
      if (score >= range.min && score <= range.max) return tier;
    }
    return 'REJECT';
  }

  /**
   * Build a human-readable explanation of the scoring decision.
   * This is the "Explainability" feature required by the spec.
   */
  private static buildReasoning(
    profile: IntercomBTCProfile,
    breakdown: ScoreBreakdown,
    tier: RiskTier,
    defaultRisk?: number
  ): string {
    const parts: string[] = [];
    const age = profile.accountAgeMonths;

    parts.push(`📊 Credit Assessment for ${profile.address.slice(0, 12)}...`);
    parts.push('');

    // Balance reasoning
    if (profile.btcBalance >= 2) {
      parts.push(`✅ Strong BTC balance of ${profile.btcBalance.toFixed(4)} BTC (+${breakdown.balanceScore} pts) — significant collateral value signals financial stability.`);
    } else if (profile.btcBalance >= 0.5) {
      parts.push(`🟡 Moderate BTC balance of ${profile.btcBalance.toFixed(4)} BTC (+${breakdown.balanceScore} pts).`);
    } else {
      parts.push(`⚠️ Low BTC balance of ${profile.btcBalance.toFixed(4)} BTC (+${breakdown.balanceScore} pts) — limited collateral.`);
    }

    // Activity reasoning
    if (age >= 12) {
      parts.push(`✅ Account active for ${age} months with ${profile.txCount} total transactions (+${breakdown.activityScore} pts) — Intercom profile shows consistent on-chain behavior since ${new Date(profile.firstSeenTimestamp).getFullYear()}.`);
    } else if (age >= 6) {
      parts.push(`🟡 Account active for ${age} months, ${profile.txCount} total transactions (+${breakdown.activityScore} pts).`);
    } else {
      parts.push(`⚠️ New account (${age} months). Limited on-chain history (+${breakdown.activityScore} pts).`);
    }

    // TAP token reasoning
    const trac = profile.tapTokens.find(t => t.ticker.toUpperCase() === 'TRAC');
    if (trac && (trac.usdValue ?? 0) > 100) {
      parts.push(`✅ $TRAC holder (${trac.amount.toLocaleString()} TRAC, ≈$${(trac.usdValue ?? 0).toLocaleString()}) — TAP ecosystem participant receives premium rate (+${breakdown.assetScore} pts).`);
    } else if (breakdown.assetScore > 0) {
      parts.push(`🟡 TAP token holdings contribute +${breakdown.assetScore} pts.`);
    }

    // Reputation bonus
    if (breakdown.reputationBonus > 0) {
      parts.push(`✅ Positive Intercom reputation: ${profile.signals.filter(s => s.signalType === 'REPAID').length} successful repayment(s) recorded by peer agents (+${breakdown.reputationBonus} pts).`);
    } else if (breakdown.reputationBonus < 0) {
      parts.push(`🚫 Negative Intercom signals detected (${breakdown.reputationBonus} pts).`);
    }

    // ML Default prediction (bonus feature)
    if (defaultRisk !== undefined) {
      const riskPercent = (defaultRisk * 100).toFixed(1);
      if (defaultRisk < 0.1) {
        parts.push(`🤖 ML Prediction: Very low default risk (${riskPercent}%) — strong repayment likelihood based on historical patterns.`);
      } else if (defaultRisk < 0.3) {
        parts.push(`🤖 ML Prediction: Moderate default risk (${riskPercent}%) — monitor repayment closely.`);
      } else {
        parts.push(`🤖 ML Prediction: High default risk (${riskPercent}%) — consider additional collateral or reduced loan amount.`);
      }
    }

    parts.push('');
    switch (tier) {
      case 'LOW':
        parts.push(`✅ Decision: APPROVED — Low risk profile. Eligible for premium rates (${getAPRFromTier(tier)[0]}–${getAPRFromTier(tier)[1]}% APR), up to $${getMaxLoanFromTier(tier).toLocaleString()} USDt.`);
        break;
      case 'MODERATE':
        parts.push(`🟡 Decision: APPROVED — Moderate risk. Standard rates apply (${getAPRFromTier(tier)[0]}–${getAPRFromTier(tier)[1]}% APR), up to $${getMaxLoanFromTier(tier).toLocaleString()} USDt.`);
        break;
      case 'HIGH':
        parts.push(`⚠️ Decision: CONDITIONAL — High risk. Elevated rates (${getAPRFromTier(tier)[0]}–${getAPRFromTier(tier)[1]}% APR), up to $${getMaxLoanFromTier(tier).toLocaleString()} USDt. Collateral may be required.`);
        break;
      case 'REJECT':
        parts.push(`🚫 Decision: REJECTED — Insufficient on-chain history or negative signals. Recommend: build Bitcoin history for 6+ months and return.`);
        break;
    }

    return parts.join('\n');
  }

  /**
   * Determine the final APR for a specific loan request.
   * Used by the Negotiator to set the opening offer.
   */
  static getBaseAPR(creditProfile: CreditProfile): number {
    const [minAPR, maxAPR] = creditProfile.aprRange;
    const score = creditProfile.score;

    if (creditProfile.tier === 'LOW') {
      // Score 85–100 maps to 3–6%
      const fraction = (score - 85) / 15;
      return maxAPR - Math.round(fraction * (maxAPR - minAPR) * 100) / 100;
    }
    if (creditProfile.tier === 'MODERATE') {
      // Score 60–84 maps to 10–14%
      const fraction = (score - 60) / 24;
      return maxAPR - Math.round(fraction * (maxAPR - minAPR) * 100) / 100;
    }
    return maxAPR; // Worst case
  }
}

export default ScoringEngine;
