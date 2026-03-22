// ═══════════════════════════════════════════════════════════════
// src/data/IntercomProvider.ts — Trac Systems Intercom Protocol Client
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Queries the Trac Intercom Indexers to retrieve:
//   • Bitcoin on-chain history (balance, tx count, age)
//   • TAP Protocol token balances (e.g., $TRAC)
//   • Cross-agent reputation signals (loan repayment history)
//
// Architecture:
//   Real mode  → HTTP calls to INTERCOM_INDEXER_URL
//   Demo mode  → deterministic mock data based on BTC address
// ═══════════════════════════════════════════════════════════════

import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import {
  IntercomBTCProfile,
  TAPTokenBalance,
  IntercomSignal,
  LoanToken,
} from '@/types';
import Logger from '@/utils/logger';

const INTERCOM_SC_BRIDGE_URL = process.env.INTERCOM_SC_BRIDGE_URL ?? process.env.INTERCOM_INDEXER_URL?.replace(/^http/, 'ws') ?? 'ws://localhost:9021';

// ── Demo profile seeded from env ──────────────────────────────
const DEMO_BTC_PRICE = 65_000; // USD per BTC

/**
 * Generate deterministic demo data from an address hash so
 * the same address always returns the same profile in demo mode.
 */
function seedFromAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash) + address.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function sendScBridgeCommand(payload: Record<string, unknown>): Promise<any> {
  const ws = new WebSocket(INTERCOM_SC_BRIDGE_URL, { timeout: 15000 });
  return new Promise((resolve, reject) => {
    let answered = false;

    ws.on('open', () => {
      ws.send(JSON.stringify(payload));
    });

    ws.on('message', (data) => {
      answered = true;
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : JSON.parse(data.toString());
        resolve(parsed);
      } catch (err) {
        reject(err);
      } finally {
        ws.close();
      }
    });

    ws.on('error', (err) => {
      if (!answered) {
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!answered) {
        reject(new Error('Intercom SC-Bridge connection closed before response'));
      }
    });
  });
}

export class IntercomProvider {
  private static client: AxiosInstance | null = null;

  private static getClient(): AxiosInstance {
    if (!this.client) {
      this.client = axios.create({
        baseURL:  process.env.INTERCOM_INDEXER_URL ?? 'https://indexer.trac.network',
        timeout:  15_000,
        headers: {
          'Authorization': `Bearer ${process.env.INTERCOM_API_KEY ?? ''}`,
          'X-Agent-ID':    process.env.INTERCOM_AGENT_ID ?? 'galactica-lending-bot-v1',
          'Content-Type':  'application/json',
        },
      });
    }
    return this.client;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch a complete on-chain profile for a Bitcoin address.
   * This is the primary entry point used by the ScoringEngine.
   */
  static async getProfile(btcAddress: string): Promise<IntercomBTCProfile> {
    Logger.info(`[Intercom] Fetching profile for ${btcAddress}`);

    if (process.env.DEMO_MODE === 'true') {
      return this.buildDemoProfile(btcAddress);
    }

    try {
      const isBridgeEnabled = Boolean(process.env.INTERCOM_SC_BRIDGE_URL);
      const connection = isBridgeEnabled
        ? await sendScBridgeCommand({ type: 'getProfile', address: btcAddress })
        : null;

      if (connection && connection.data) {
        const payload = connection.data;
        return {
          address: btcAddress,
          btcBalance: payload.btcBalance ?? 0,
          btcBalanceUSD: payload.btcBalanceUSD ?? 0,
          txCount: payload.txCount ?? 0,
          txLast6Months: payload.txLast6Months ?? 0,
          firstSeenTimestamp: payload.firstSeenTimestamp ?? Date.now(),
          lastSeenTimestamp: payload.lastSeenTimestamp ?? Date.now(),
          accountAgeMonths: payload.accountAgeMonths ?? 0,
          tapTokens: payload.tapTokens ?? [],
          totalValueUSD: payload.totalValueUSD ?? 0,
          isBlacklisted: payload.isBlacklisted ?? false,
          signals: payload.signals ?? [],
        };
      }

      const [btcData, tapData, signals] = await Promise.all([
        this.fetchBTCHistory(btcAddress),
        this.fetchTAPBalances(btcAddress),
        this.fetchReputationSignals(btcAddress),
      ]);

      const profile: IntercomBTCProfile = {
        address:             btcAddress,
        btcBalance:          btcData.balance,
        btcBalanceUSD:       btcData.balance * DEMO_BTC_PRICE,
        txCount:             btcData.txCount,
        txLast6Months:       btcData.txLast6Months,
        firstSeenTimestamp:  btcData.firstSeen,
        lastSeenTimestamp:   btcData.lastSeen,
        accountAgeMonths:    this.ageInMonths(btcData.firstSeen),
        tapTokens:           tapData,
        totalValueUSD:       btcData.balance * DEMO_BTC_PRICE + this.sumTAPValue(tapData),
        isBlacklisted:       false,
        signals,
      };

      Logger.success(`[Intercom] Profile loaded: ${btcAddress}`, {
        balance: btcData.balance,
        txCount: btcData.txCount,
        signals: signals.length,
      });

      return profile;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      Logger.error(`[Intercom] Failed to fetch profile: ${error}`, { btcAddress });
      // Return minimal profile on error so scoring engine can still run
      return this.buildEmptyProfile(btcAddress);
    }
  }

  /**
   * Broadcast a reputation signal after loan settlement.
   * Other agents will receive this via Intercom pub/sub.
   */
  static async broadcastSignal(signal: IntercomSignal): Promise<boolean> {
    Logger.info('[Intercom] Broadcasting reputation signal', {
      address: signal.agentId,
      type:    signal.signalType,
      amount:  signal.loanAmount,
    });

    if (process.env.DEMO_MODE === 'true') {
      Logger.success('[Intercom] Signal broadcast (DEMO)', signal as unknown as Record<string, unknown>);
      return true;
    }

    try {
      if (process.env.INTERCOM_SC_BRIDGE_URL) {
        await sendScBridgeCommand({
          type: 'broadcastSignal',
          channel: process.env.INTERCOM_BROADCAST_CHANNEL ?? 'lending-signals',
          signal,
        });
      } else {
        await this.getClient().post('/v1/signals/broadcast', {
          channel: process.env.INTERCOM_BROADCAST_CHANNEL ?? 'lending-signals',
          signal,
        });
      }

      Logger.success('[Intercom] Reputation signal broadcast confirmed');
      return true;
    } catch (err) {
      Logger.error('[Intercom] Signal broadcast failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Check if another lending agent has spare liquidity.
   * Used when this agent's treasury is running low.
   */
  static async requestLiquidityFromPeers(amountNeeded: number, token: LoanToken): Promise<{
    available: boolean;
    agentId?: string;
    amount?: number;
  }> {
    Logger.info(`[Intercom] Requesting liquidity from peer agents`, { amountNeeded, token });

    if (process.env.DEMO_MODE === 'true') {
      // Simulate finding a peer agent with liquidity
      const found = Math.random() > 0.3;
      if (found) {
        Logger.success('[Intercom] Peer liquidity found: Agent-X offers capacity');
        return { available: true, agentId: 'Agent-X-Galactica', amount: amountNeeded };
      }
      Logger.warn('[Intercom] No peer liquidity available at this time');
      return { available: false };
    }

    try {
      const resp = await this.getClient().post('/v1/agents/liquidity-request', {
        token,
        amountNeeded,
        requestingAgent: process.env.INTERCOM_AGENT_ID,
      });
      return resp.data;
    } catch {
      return { available: false };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Real API calls
  // ─────────────────────────────────────────────────────────────

  private static async fetchBTCHistory(address: string): Promise<{
    balance: number;
    txCount: number;
    txLast6Months: number;
    firstSeen: number;
    lastSeen: number;
  }> {
    const resp = await this.getClient().get(`/v1/bitcoin/address/${address}/history`);
    return {
      balance:       resp.data.confirmed_balance_btc ?? 0,
      txCount:       resp.data.tx_count              ?? 0,
      txLast6Months: resp.data.tx_last_6_months      ?? 0,
      firstSeen:     resp.data.first_seen_timestamp  ?? Date.now(),
      lastSeen:      resp.data.last_seen_timestamp   ?? Date.now(),
    };
  }

  private static async fetchTAPBalances(address: string): Promise<TAPTokenBalance[]> {
    try {
      const resp = await this.getClient().get(`/v1/tap/address/${address}/balances`);
      return (resp.data.tokens ?? []).map((t: Record<string, unknown>) => ({
        ticker:     t.ticker   as string,
        amount:     t.amount   as number,
        usdValue:   t.usd_value as number | undefined,
        contractId: t.contract_id as string | undefined,
      }));
    } catch {
      return [];
    }
  }

  private static async fetchReputationSignals(address: string): Promise<IntercomSignal[]> {
    try {
      const resp = await this.getClient().get(`/v1/signals/${address}`);
      return resp.data.signals ?? [];
    } catch {
      return [];
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Demo / Mock data
  // ─────────────────────────────────────────────────────────────

  private static buildDemoProfile(btcAddress: string): IntercomBTCProfile {
    const seed   = seedFromAddress(btcAddress);
    const rng    = (min: number, max: number) => min + (seed % (max - min + 1));

    // Use env overrides if this is the demo address
    const isDemoAddr = btcAddress === process.env.DEMO_BTC_ADDRESS;

    const btcBalance    = isDemoAddr
      ? parseFloat(process.env.DEMO_BTC_BALANCE ?? '2.5')
      : (rng(0, 500)) / 100;           // 0.00 – 5.00 BTC

    const txCount       = isDemoAddr
      ? parseInt(process.env.DEMO_TX_COUNT ?? '1420', 10)
      : rng(10, 2000);

    const txLast6Months = Math.floor(txCount * (rng(10, 60) / 100));
    const ageMonths     = rng(6, 72);
    const firstSeen     = Date.now() - ageMonths * 30 * 24 * 60 * 60 * 1000;

    const tapTokens: TAPTokenBalance[] = [
      { ticker: 'TRAC', amount: rng(100, 10000), usdValue: rng(50, 5000) },
      { ticker: 'NAT',  amount: rng(0, 5000),   usdValue: rng(0, 500)  },
    ];

    // Simulate Intercom reputation signals from other agents
    const signals: IntercomSignal[] = btcBalance > 1 ? [
      {
        agentId:    'DeFi-Agent-Alpha',
        signalType: 'REPAID',
        loanAmount: 500,
        token:      'USDt',
        timestamp:  firstSeen + 90 * 24 * 60 * 60 * 1000,
        message:    'Loan of 500 USDt repaid on time.',
        txHash:     '4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b',
      },
    ] : [];

    const profile: IntercomBTCProfile = {
      address:            btcAddress,
      btcBalance,
      btcBalanceUSD:      btcBalance * DEMO_BTC_PRICE,
      txCount,
      txLast6Months,
      firstSeenTimestamp: firstSeen,
      lastSeenTimestamp:  Date.now() - rng(0, 30) * 24 * 60 * 60 * 1000,
      accountAgeMonths:   ageMonths,
      tapTokens,
      totalValueUSD:      btcBalance * DEMO_BTC_PRICE + this.sumTAPValue(tapTokens),
      isBlacklisted:      false,
      signals,
    };

    Logger.info('[Intercom] Demo profile built', {
      address:  btcAddress,
      balance:  `${btcBalance} BTC`,
      txCount,
      tapTokens: tapTokens.map(t => `${t.amount} ${t.ticker}`).join(', '),
    });

    return profile;
  }

  private static buildEmptyProfile(btcAddress: string): IntercomBTCProfile {
    return {
      address:            btcAddress,
      btcBalance:         0,
      btcBalanceUSD:      0,
      txCount:            0,
      txLast6Months:      0,
      firstSeenTimestamp: Date.now(),
      lastSeenTimestamp:  Date.now(),
      accountAgeMonths:   0,
      tapTokens:          [],
      totalValueUSD:      0,
      isBlacklisted:      false,
      signals:            [],
    };
  }

  private static ageInMonths(firstSeen: number): number {
    return Math.floor((Date.now() - firstSeen) / (30 * 24 * 60 * 60 * 1000));
  }

  private static sumTAPValue(tokens: TAPTokenBalance[]): number {
    return tokens.reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
  }
}

export default IntercomProvider;
