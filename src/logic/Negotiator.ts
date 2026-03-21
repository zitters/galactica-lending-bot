// ═══════════════════════════════════════════════════════════════
// src/logic/Negotiator.ts — LLM-Driven Loan Term Negotiator
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// OpenClaw autonomous negotiation engine powered by GPT-4o.
// Persona: "ARIA" — Autonomous Risk Intelligence Agent.
//
// Capabilities:
//   • Opens with a risk-adjusted offer based on the credit score
//   • Dynamically lowers rate by up to 2% if borrower shortens tenure
//   • Refuses amounts > maxLoanUSDt for the given risk tier
//   • Explains every decision with on-chain data from Intercom
//   • Outputs structured LoanOffer on acceptance
// ═══════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  CreditProfile,
  NegotiationContext,
  LoanOffer,
  LoanToken,
  ChatMessage,
} from '@/types';
import { ScoringEngine }   from './ScoringEngine';
import { calculateRepayment, formatUSD, formatDuration } from '@/utils/helpers';
import Logger from '@/utils/logger';

const MAX_RATE_DISCOUNT = 2.0;   // Max APR reduction via negotiation
const MIN_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 90;

// ── In-memory session store ───────────────────────────────────
const sessions = new Map<string, NegotiationContext>();

export class Negotiator {
  private static openai: OpenAI | null = null;

  private static getOpenAI(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY ?? '',
      });
    }
    return this.openai;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /**
   * Start a new negotiation session.
   * Returns sessionId + the AI's opening offer message.
   */
  static async startSession(
    creditProfile: CreditProfile,
    requestedAmount: number,
    requestedToken: LoanToken,
    requestedDurationDays: number
  ): Promise<{ sessionId: string; message: string; offer?: LoanOffer }> {
    const sessionId = uuidv4();

    const context: NegotiationContext = {
      sessionId,
      btcAddress:           creditProfile.btcAddress,
      creditProfile,
      requestedAmount,
      requestedToken,
      requestedDurationDays,
      messages:             [],
      negotiationRound:     0,
      status:               'OPEN',
    };

    sessions.set(sessionId, context);
    Logger.info('[Negotiator] Session started', { sessionId, address: creditProfile.btcAddress });

    // Generate opening offer
    const response = await this.generateOffer(context, 'INIT');
    return { sessionId, message: response.message, offer: response.offer };
  }

  /**
   * Continue an existing negotiation session with a user message.
   */
  static async chat(
    sessionId: string,
    userMessage: string
  ): Promise<{ message: string; offer?: LoanOffer; status: NegotiationContext['status'] }> {
    const context = sessions.get(sessionId);
    if (!context) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    if (context.status !== 'OPEN') {
      return {
        message: `This negotiation is already ${context.status.toLowerCase()}.`,
        offer:   context.currentOffer,
        status:  context.status,
      };
    }

    // Add user message to history
    context.messages.push({
      role:      'user',
      content:   userMessage,
      timestamp: Date.now(),
    });
    context.negotiationRound++;

    // Detect explicit acceptance
    const acceptKeywords = ['accept', 'agreed', 'deal', 'ok', 'yes', 'confirm', 'approve', 'take it'];
    const rejectKeywords = ['reject', 'no', 'decline', 'cancel', 'abort'];

    const normalized = userMessage.toLowerCase();

    if (acceptKeywords.some(kw => normalized.includes(kw))) {
      context.status = 'ACCEPTED';
      sessions.set(sessionId, context);
      const acceptMsg = this.buildAcceptanceMessage(context);
      Logger.success('[Negotiator] Terms accepted', {
        sessionId,
        offer: context.currentOffer,
      });
      return { message: acceptMsg, offer: context.currentOffer, status: 'ACCEPTED' };
    }

    if (rejectKeywords.some(kw => normalized.includes(kw))) {
      context.status = 'REJECTED';
      sessions.set(sessionId, context);
      Logger.info('[Negotiator] Terms rejected', { sessionId });
      return {
        message: 'Understood. This loan request has been declined. You may return with updated terms anytime.',
        status:  'REJECTED',
      };
    }

    // Continue negotiation with LLM
    const response = await this.generateOffer(context, 'COUNTER');
    sessions.set(sessionId, context);
    return { message: response.message, offer: response.offer, status: context.status };
  }

  /**
   * Retrieve a session by ID.
   */
  static getSession(sessionId: string): NegotiationContext | null {
    return sessions.get(sessionId) ?? null;
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Core LLM Logic
  // ─────────────────────────────────────────────────────────────

  private static async generateOffer(
    context: NegotiationContext,
    mode: 'INIT' | 'COUNTER'
  ): Promise<{ message: string; offer?: LoanOffer }> {
    const { creditProfile, requestedAmount, requestedToken, requestedDurationDays } = context;

    // Compute the base offer
    const baseAPR  = ScoringEngine.getBaseAPR(creditProfile);
    const capAmount = Math.min(requestedAmount, creditProfile.maxLoanUSDt);
    const capDuration = Math.max(MIN_DURATION_DAYS, Math.min(MAX_DURATION_DAYS, requestedDurationDays));

    // Discount logic: shorter tenure = lower rate
    let offeredAPR = baseAPR;
    if (mode === 'COUNTER' && context.messages.length > 0) {
      const lastMsg   = context.messages.slice(-1)[0]?.content ?? '';
      const shorter   = this.detectShorterTenureRequest(lastMsg, capDuration);
      if (shorter.detected && shorter.newDuration < capDuration) {
        const reduction = Math.min(
          MAX_RATE_DISCOUNT,
          ((capDuration - shorter.newDuration) / capDuration) * MAX_RATE_DISCOUNT
        );
        offeredAPR = Math.max(baseAPR - reduction, creditProfile.aprRange[0]);
        Logger.info('[Negotiator] Rate discount applied', {
          originalAPR: baseAPR,
          reduction:   reduction.toFixed(2),
          newAPR:      offeredAPR.toFixed(2),
          newDuration: shorter.newDuration,
        });
      }
    }

    offeredAPR = Math.round(offeredAPR * 100) / 100;
    const { totalRepayment, dailyRepayment } = calculateRepayment(capAmount, offeredAPR, capDuration);

    const offer: LoanOffer = {
      sessionId:       context.sessionId,
      amount:          capAmount,
      token:           requestedToken,
      aprPercent:      offeredAPR,
      durationDays:    capDuration,
      totalRepayment,
      dailyRepayment,
      expiresAt:       Date.now() + 15 * 60 * 1000, // 15 min
      reasoning:       creditProfile.reasoning,
    };

    context.currentOffer = offer;

    // ── Demo Mode: skip real LLM call ─────────────────────────
    if (process.env.DEMO_MODE === 'true' || !process.env.OPENAI_API_KEY) {
      const demoMsg = this.buildDemoMessage(context, offer, mode);
      context.messages.push({ role: 'assistant', content: demoMsg, timestamp: Date.now() });
      return { message: demoMsg, offer };
    }

    // ── Real LLM call ─────────────────────────────────────────
    try {
      const systemPrompt = this.buildSystemPrompt(creditProfile);
      const userContext  = this.buildUserContext(context, offer);

      const completion = await this.getOpenAI().chat.completions.create({
        model:       process.env.OPENAI_MODEL ?? 'gpt-4o',
        max_tokens:  parseInt(process.env.OPENAI_MAX_TOKENS ?? '512', 10),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0.7'),
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.messages.slice(-6).map(m => ({
            role:    m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: userContext },
        ],
      });

      const aiMessage = completion.choices[0]?.message?.content ?? 'Processing your request...';
      context.messages.push({ role: 'assistant', content: aiMessage, timestamp: Date.now() });
      return { message: aiMessage, offer };
    } catch (err) {
      Logger.error('[Negotiator] LLM call failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback to rule-based message
      const fallback = this.buildDemoMessage(context, offer, mode);
      context.messages.push({ role: 'assistant', content: fallback, timestamp: Date.now() });
      return { message: fallback, offer };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Message Builders
  // ─────────────────────────────────────────────────────────────

  private static buildSystemPrompt(creditProfile: CreditProfile): string {
    return `You are ARIA (Autonomous Risk Intelligence Agent), a sophisticated AI lending bot for the Galactica DeFi ecosystem.

MISSION: Evaluate loan requests fairly, protect the lending pool, and help creditworthy borrowers access liquidity.

BORROWER PROFILE (from Intercom Protocol on-chain analysis):
- Credit Score: ${creditProfile.score}/100
- Risk Tier: ${creditProfile.tier}
- Max Loan Eligible: $${creditProfile.maxLoanUSDt.toLocaleString()} USDt
- APR Range: ${creditProfile.aprRange[0]}–${creditProfile.aprRange[1]}%
- Reasoning: ${creditProfile.reasoning}

NEGOTIATION RULES:
1. You MAY lower the APR by a maximum of ${MAX_RATE_DISCOUNT}% if the borrower shortens loan duration by 50%
2. You CANNOT exceed the max loan amount for their risk tier
3. Always reference the Intercom Protocol data in your reasoning
4. Be professional but firm — you are protecting the lending pool
5. Keep responses concise (2–4 sentences max) with the structured offer at the end

FORMAT: Always end with a structured offer block like:
📋 OFFER: [amount] [token] | APR: [rate]% | Duration: [days] days | Total Repayment: $[amount]`;
  }

  private static buildUserContext(context: NegotiationContext, offer: LoanOffer): string {
    const { totalRepayment } = calculateRepayment(offer.amount, offer.aprPercent, offer.durationDays);
    return `Current offer to present:
Amount: ${offer.amount} ${offer.token}
APR: ${offer.aprPercent}%
Duration: ${offer.durationDays} days
Total Repayment: ${formatUSD(totalRepayment)}

${context.negotiationRound === 0
      ? 'Generate the opening offer message for this borrower.'
      : `The borrower responded: "${context.messages.slice(-2)[0]?.content ?? ''}". Generate your counter-response and updated offer.`
    }`;
  }

  private static buildDemoMessage(
    context: NegotiationContext,
    offer: LoanOffer,
    mode: 'INIT' | 'COUNTER'
  ): string {
    const { creditProfile } = context;
    const repayment = calculateRepayment(offer.amount, offer.aprPercent, offer.durationDays);
    const collateralPercent = parseFloat(process.env.COLLATERAL_REQUIREMENT_PERCENT ?? '25');
    const BTC_PRICE = 95000; // USD per BTC (adjust based on market)
    // Convert collateral requirement from USD to BTC
    const collateralUSD = Math.max(offer.amount * (collateralPercent / 100), 95); // Min $95
    const collateralRequired = collateralUSD / BTC_PRICE; // Convert to BTC (realistic 0.005-0.02 BTC range)
    const ethWithdrawAddress = process.env.AGENT_ETH_WITHDRAW_ADDRESS ?? '0x742d35...';
    const shortETH = `${ethWithdrawAddress.substring(0, 8)}...${ethWithdrawAddress.substring(ethWithdrawAddress.length - 6)}`;
    const collateralContractAddress = process.env.COLLATERAL_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000';
    const shortContract = `${collateralContractAddress.substring(0, 8)}...${collateralContractAddress.substring(collateralContractAddress.length - 6)}`;

    if (mode === 'INIT') {
      return [
        `👋 Hello! I'm **ARIA**, your Autonomous Risk Intelligence Agent.`,
        ``,
        `I've analyzed your Bitcoin wallet via the **Intercom Protocol** and your on-chain profile is impressive:`,
        `📊 Credit Score: **${creditProfile.score}/100** (${creditProfile.tier} Risk)`,
        ``,
        `Based on your on-chain history — ${creditProfile.score >= 85
          ? 'stable holdings, strong transaction frequency, and positive peer signals'
          : 'moderate on-chain activity'
        } — here's my opening offer:`,
        ``,
        `📋 **OFFER:**`,
        `• Loan: **${offer.amount} ${offer.token}**`,
        `• APR: **${offer.aprPercent}%**`,
        `• Duration: **${formatDuration(offer.durationDays)}**`,
        `• Total Repayment: **${formatUSD(repayment.totalRepayment)}**`,
        ``,
        `🔐 **Collateral & Settlement:**`,
        `• **Collateral:** ${collateralRequired.toFixed(6)} WBTC (≈ $${collateralUSD.toFixed(2)})`,
        `  🔒 *Locked in Smart Contract: ${shortContract}*`,
        `• **Settlement:** ${offer.amount} ${offer.token} → ${shortETH} (Ethereum)`,
        ``,
        `⚠️ *Next: You'll sign a transaction to lock collateral in our escrow contract before funds are released.*`,
        ``,
        `💡 *Tip: I can lower the rate by up to 2% if you repay within ${Math.floor(offer.durationDays / 2)} days.*`,
        ``,
        `Type **"Accept"** to confirm, or counter with your preferred terms.`,
      ].join('\n');
    }

    // Counter-offer message
    // In real mode, evaluate the request first
    const lastUserMessage = context.messages.filter(m => m.role === 'user').pop()?.content || '';
    const evaluation = Negotiator.evaluateNegotiationRequest(lastUserMessage, creditProfile, offer);

    if (evaluation.action === 'ACCEPT') {
      return [
        `✅ Great! Your terms are accepted.`,
        `Proceeding to collateral lock and settlement...`,
      ].join('\n');
    }

    if (evaluation.action === 'DECLINE') {
      return [
        `❌ I cannot accommodate this request.`,
        `**Reason:** ${evaluation.explanation}`,
        ``,
        `Your current offer remains:`,
        `📋 **OFFER:**`,
        `• Loan: **${offer.amount} ${offer.token}**`,
        `• APR: **${offer.aprPercent}%**`,
        `• Duration: **${formatDuration(offer.durationDays)}**`,
      ].join('\n');
    }

    // COUNTER or ACCEPT_WITH_CHANGE: propose adjusted terms
    return [
      `⚡ I understand your request. Based on risk analysis:`,
      `"${evaluation.explanation}"`,
      ``,
      `Let me adjust the terms:`,
      ``,
      `📋 **REVISED OFFER:**`,
      `• Loan: **${offer.amount} ${offer.token}**`,
      `• APR: **${offer.aprPercent}%** ${offer.aprPercent < ScoringEngine.getBaseAPR(creditProfile)
        ? `✅ *(reduced)*`
        : `⚠️ *(optimized for your request)*`
      }`,
      `• Duration: **${formatDuration(offer.durationDays)}**`,
      `• Total Repayment: **${formatUSD(repayment.totalRepayment)}**`,
      ``,
      `🔐 **Collateral (Adjusted):**`,
      `• **Collateral:** ${collateralRequired.toFixed(6)} WBTC`,
      `  🔒 *Smart Contract: ${shortContract}*`,
      ``,
      `Type **"Accept"** to confirm these adjusted terms.`,
    ].join('\n');
  }

  private static buildAcceptanceMessage(context: NegotiationContext): string {
    const offer = context.currentOffer!;
    const collateralPercent = parseFloat(process.env.COLLATERAL_REQUIREMENT_PERCENT ?? '25');
    const BTC_PRICE = 95000;
    const collateralUSD = Math.max(offer.amount * (collateralPercent / 100), 95);
    const collateralRequired = collateralUSD / BTC_PRICE;
    const ethWithdrawAddress = process.env.AGENT_ETH_WITHDRAW_ADDRESS ?? '0x742d35...';
    const shortETH = `${ethWithdrawAddress.substring(0, 8)}...${ethWithdrawAddress.substring(ethWithdrawAddress.length - 6)}`;
    const collateralContractAddress = process.env.COLLATERAL_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000';
    const shortContract = `${collateralContractAddress.substring(0, 8)}...${collateralContractAddress.substring(collateralContractAddress.length - 6)}`;

    return [
      `✅ **Terms Accepted!**`,
      ``,
      `Excellent. Loan terms are locked in. Initiating collateral escrow & settlement...`,
      ``,
      `📋 **Final Terms:**`,
      `• Amount: **${offer.amount} ${offer.token}**`,
      `• APR: **${offer.aprPercent}%**`,
      `• Duration: **${formatDuration(offer.durationDays)}**`,
      `• Total Repayment: **${formatUSD(offer.totalRepayment)}**`,
      `• Due Date: **${new Date(Date.now() + offer.durationDays * 86400000).toLocaleDateString('en-US')}**`,
      ``,
      `🔐 **Collateral & Settlement:**`,
      `• **Collateral:** ${collateralRequired.toFixed(6)} WBTC (≈ $${collateralUSD.toFixed(2)})`,
      `  → Locked in Escrow: ${shortContract}`,
      `• **Funds:** ${offer.amount} ${offer.token} → ${shortETH}`,
      `• **Powered by:** WDK (Tether Settlement Layer)`,
      ``,
      `⏳ *Collateral escrow & WDK settlement in progress... funds secured within 1-2 minutes.*`,
    ].join('\n');
  }

  private static detectShorterTenureRequest(
    message: string,
    currentDuration: number
  ): { detected: boolean; newDuration: number } {
    const patterns = [
      /(\d+)\s*day/i,
      /(\d+)\s*week/i,
    ];

    for (const pat of patterns) {
      const m = pat.exec(message);
      if (m) {
        let days = parseInt(m[1], 10);
        if (pat.source.includes('week')) days *= 7;
        if (days < currentDuration && days >= MIN_DURATION_DAYS) {
          return { detected: true, newDuration: days };
        }
      }
    }
    return { detected: false, newDuration: currentDuration };
  }

  /**
   * Evaluate if a user's negotiation request should be accepted or countered
   * Returns meaningful response based on whether we can accommodate the request
   */
  private static evaluateNegotiationRequest(
    message: string,
    creditProfile: CreditProfile,
    currentOffer: LoanOffer
  ): { action: 'ACCEPT' | 'ACCEPT_WITH_CHANGE' | 'COUNTER' | 'DECLINE'; explanation: string } {
    const lowerMessage = message.toLowerCase();

    // Check for explicit acceptance
    if (/\baccept\b|^yes\b|^agree\b|^ok\b/i.test(message)) {
      return {
        action: 'ACCEPT',
        explanation: 'User accepted the offer',
      };
    }

    // Check for rate reduction request
    if (/lower.*rate|reduce.*apr|cheaper|less.*interest|lower.*%/i.test(message)) {
      // Can lower rate by max 2% if duration is reduced significantly
      const durationReduction = Negotiator.detectShorterTenureRequest(message, currentOffer.durationDays);
      if (durationReduction.detected && durationReduction.newDuration <= currentOffer.durationDays / 2) {
        return {
          action: 'ACCEPT_WITH_CHANGE',
          explanation: 'Shorter duration justifies lower rate',
        };
      }
      return {
        action: 'COUNTER',
        explanation: 'Rate reduction requires shorter repayment terms',
      };
    }

    // Check for duration extension request
    if (/longer|more.*time|extend|more.*days|more.*week/i.test(message)) {
      if (creditProfile.score >= 80) {
        return {
          action: 'ACCEPT_WITH_CHANGE',
          explanation: 'Strong credit profile allows duration extension',
        };
      }
      return {
        action: 'COUNTER',
        explanation: 'Your risk profile does not support extended terms',
      };
    }

    // Check for amount increase request
    if (/more.*usd|higher.*amount|increase|need.*more|can.*i.*borrow|larger/i.test(message)) {
      const maxLoan = creditProfile.maxLoanUSDt;
      if (currentOffer.amount < maxLoan * 0.8) {
        return {
          action: 'ACCEPT_WITH_CHANGE',
          explanation: 'Modest increase acceptable within your max limit',
        };
      }
      return {
        action: 'DECLINE',
        explanation: 'You are at or near your maximum loan capacity',
      };
    }

    // Check if user is negotiating for fixed terms
    if (/\d+.*%|apr|apy|rate/i.test(message)) {
      const rateMatch = /(\d+(?:\.\d+)?)\s*%/i.exec(message);
      if (rateMatch) {
        const requestedRate = parseFloat(rateMatch[1]);
        const [minRate, maxRate] = creditProfile.aprRange;

        if (requestedRate < minRate - 2) {
          return {
            action: 'DECLINE',
            explanation: 'Requested rate is below minimum for your risk profile',
          };
        }
        if (requestedRate >= minRate && requestedRate <= maxRate) {
          return {
            action: 'ACCEPT_WITH_CHANGE',
            explanation: 'Requested rate is within acceptable range',
          };
        }
      }
    }

    // Default: ask for clarification
    return {
      action: 'COUNTER',
      explanation: 'Please specify which terms you would like to adjust (rate, duration, amount)',
    };
  }
}

export default Negotiator;
