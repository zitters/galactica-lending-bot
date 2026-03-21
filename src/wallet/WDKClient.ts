// ═══════════════════════════════════════════════════════════════
// src/wallet/WDKClient.ts — Tether Wallet Dev Kit Integration
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// Self-custodial settlement layer using Tether's Wallet Dev Kit.
// Supports: USD₮ and XAUt (gold-backed) token transfers.
//
// Security model:
//   • Private key stored ONLY in .env — never in code or DB
//   • All transfers require loan ID for traceability
//   • Balance checks before every transfer
//   • Full audit trail via WDK's on-chain receipts
// ═══════════════════════════════════════════════════════════════

import axios, { AxiosInstance } from 'axios';
import {
  WDKTransferRequest,
  WDKTransferResult,
  WalletBalance,
  LoanToken,
  YieldPosition,
} from '@/types';
import { generateMockTxHash, sleep } from '@/utils/helpers';
import Logger from '@/utils/logger';

const WDK_TX_FEE_USDT = 0.50; // $0.50 flat fee per transfer (demo)

export class WDKClient {
  private static client: AxiosInstance | null = null;

  private static getClient(): AxiosInstance {
    if (!this.client) {
      this.client = axios.create({
        baseURL: process.env.WDK_API_URL ?? 'https://wdk.tether.io/api/v1',
        timeout: 30_000,
        headers: {
          'X-WDK-API-Key':    process.env.WDK_API_KEY    ?? '',
          'X-WDK-API-Secret': process.env.WDK_API_SECRET ?? '',
          'Content-Type':     'application/json',
        },
      });
    }
    return this.client;
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────

  /**
   * Check the agent's treasury balances.
   */
  static async getBalance(): Promise<WalletBalance> {
    if (process.env.DEMO_MODE === 'true') {
      return this.getDemoBalance();
    }

    try {
      const resp = await this.getClient().get('/wallet/balance');
      return {
        USDt:        resp.data.usdt_balance  ?? 0,
        XAUt:        resp.data.xaut_balance  ?? 0,
        lastUpdated: Date.now(),
      };
    } catch (err) {
      Logger.error('[WDK] Failed to fetch balance', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.getDemoBalance();
    }
  }

  /**
   * Send USD₮ or XAUt to a borrower.
   * This is the core settlement function triggered after loan acceptance.
   * 
   * IMPORTANT: 
   * - Borrower identifies via Bitcoin (BIP-137)
   * - Collateral is held in THEIR Bitcoin address (from creditProfile.btcAddress)
   * - Funds are sent to AGENT_ETH_WITHDRAW_ADDRESS (Ethereum)
   * - Percentage is locked as collateral requirement
   */
  static async sendFunds(request: WDKTransferRequest): Promise<WDKTransferResult> {
    const ethWithdrawAddress = process.env.AGENT_ETH_WITHDRAW_ADDRESS ?? '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
    const collateralPercent = parseFloat(process.env.COLLATERAL_REQUIREMENT_PERCENT ?? '25') / 100;
    const collateralBTCMin = parseFloat(process.env.COLLATERAL_MIN_BTC ?? '0.001');
    
    // Calculate collateral requirement
    const collateralRequired = Math.max(request.amount * collateralPercent, collateralBTCMin);

    Logger.info('[WDK] Initiating transfer', {
      borrowerBTCAddress: request.recipientAddress,
      ethWithdrawAddress: ethWithdrawAddress,
      amount:    request.amount,
      token:     request.token,
      collateralRequired: `${collateralRequired.toFixed(8)} BTC`,
      loanId:    request.loanId,
    });

    // ── Pre-flight: Check balance ────────────────────────────
    const balance = await this.getBalance();
    const available = request.token === 'USDt' ? balance.USDt : balance.XAUt;

    if (available < request.amount + WDK_TX_FEE_USDT) {
      Logger.error('[WDK] Insufficient treasury balance', {
        required:  request.amount + WDK_TX_FEE_USDT,
        available,
        token:     request.token,
      });
      return {
        success:   false,
        amount:    request.amount,
        token:     request.token,
        fee:       WDK_TX_FEE_USDT,
        timestamp: Date.now(),
        error:     `Insufficient ${request.token} balance. Required: ${request.amount + WDK_TX_FEE_USDT}, Available: ${available}`,
        ethAddress: ethWithdrawAddress,
        collateralRequired: collateralRequired,
      };
    }

    if (process.env.DEMO_MODE === 'true') {
      return this.executeDemoTransfer(request, ethWithdrawAddress, collateralRequired);
    }

    // ── Real WDK Transfer (to ETH address) ────────────────────
    try {
      const payload = {
        recipient_address:  ethWithdrawAddress, // ETH address, not BTC
        amount:             request.amount.toString(),
        token:              request.token.toLowerCase(),
        contract_address:   request.token === 'USDt'
          ? process.env.USDT_CONTRACT_ADDRESS
          : process.env.XAUT_CONTRACT_ADDRESS,
        memo:               request.memo ?? `LoanDisbursement:${request.loanId ?? 'UNKNOWN'}|Borrower:${request.recipientAddress}`,
        network:            process.env.WDK_NETWORK ?? 'mainnet',
      };

      const resp = await this.getClient().post('/transfer/send', payload);

      const result: WDKTransferResult = {
        success:     true,
        txHash:      resp.data.tx_hash,
        explorerUrl: `${process.env.BTC_EXPLORER_URL}/tx/${resp.data.tx_hash}`,
        amount:      request.amount,
        token:       request.token,
        fee:         resp.data.fee ?? WDK_TX_FEE_USDT,
        timestamp:   Date.now(),
        ethAddress:  ethWithdrawAddress,
        collateralRequired: collateralRequired,
      };

      Logger.success('[WDK] Transfer confirmed', {
        txHash:    result.txHash,
        ethAddress: ethWithdrawAddress,
        borrowerBTC: request.recipientAddress,
        amount:    `${request.amount} ${request.token}`,
        collateral: `${collateralRequired.toFixed(8)} BTC required`,
      });

      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      Logger.error('[WDK] Transfer failed', { error });
      return {
        success:   false,
        amount:    request.amount,
        token:     request.token,
        fee:       0,
        timestamp: Date.now(),
        error:     `WDK transfer error: ${error}`,
      };
    }
  }

  /**
   * Verify that a repayment transaction has been confirmed on-chain.
   */
  static async verifyRepayment(txHash: string, expectedAmount: number): Promise<{
    confirmed: boolean;
    amount:    number;
    confirmations: number;
  }> {
    Logger.info('[WDK] Verifying repayment tx', { txHash, expectedAmount });

    if (process.env.DEMO_MODE === 'true') {
      return { confirmed: true, amount: expectedAmount, confirmations: 6 };
    }

    try {
      const resp = await this.getClient().get(`/transaction/${txHash}`);
      return {
        confirmed:     resp.data.status === 'confirmed',
        amount:        parseFloat(resp.data.amount ?? '0'),
        confirmations: resp.data.confirmations ?? 0,
      };
    } catch {
      return { confirmed: false, amount: 0, confirmations: 0 };
    }
  }

  /**
   * Check for any incoming transactions to the agent's wallet
   * since a given timestamp. Used by RepaymentWatcher.
   */
  static async scanIncomingTx(since: number): Promise<Array<{
    txHash:  string;
    from:    string;
    amount:  number;
    token:   LoanToken;
    timestamp: number;
    memo?:   string;
  }>> {
    if (process.env.DEMO_MODE === 'true') {
      return []; // Repayments simulated via UI in demo mode
    }

    try {
      const resp = await this.getClient().get('/wallet/transactions', {
        params: { since, type: 'incoming' },
      });
      return (resp.data.transactions ?? []).map((tx: Record<string, unknown>) => ({
        txHash:    tx.hash          as string,
        from:      tx.from          as string,
        amount:    parseFloat(tx.amount as string),
        token:     tx.token         as LoanToken,
        timestamp: tx.timestamp     as number,
        memo:      tx.memo          as string | undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Stake idle funds into a yield protocol.
   */
  static async stakeToYield(amount: number, token: LoanToken): Promise<{
    success: boolean;
    position?: YieldPosition;
    error?: string;
  }> {
    Logger.info('[WDK] Staking to yield protocol', { amount, token });

    if (process.env.DEMO_MODE === 'true') {
      const position: YieldPosition = {
        poolAddress:  process.env.YIELD_POOL_ADDRESS ?? '0xYieldPool',
        amount,
        token,
        apy:          parseFloat(process.env.YIELD_MIN_APY ?? '3.5'),
        enteredAt:    Date.now(),
        currentValue: amount,
        earned:       0,
      };
      Logger.success('[WDK] Yield position opened (DEMO)', { amount, token });
      return { success: true, position };
    }

    try {
      const resp = await this.getClient().post('/yield/stake', {
        amount: amount.toString(),
        token:  token.toLowerCase(),
        pool:   process.env.YIELD_POOL_ADDRESS,
      });
      return { success: true, position: resp.data.position };
    } catch (err) {
      return {
        success: false,
        error:   err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: Demo Helpers
  // ─────────────────────────────────────────────────────────────

  private static getDemoBalance(): WalletBalance {
    return {
      USDt:        parseFloat(process.env.AGENT_TREASURY_USDT ?? '50000'),
      XAUt:        parseFloat(process.env.AGENT_TREASURY_XAUT ?? '10'),
      lastUpdated: Date.now(),
    };
  }

  private static async executeDemoTransfer(
    request: WDKTransferRequest,
    ethAddress: string,
    collateralRequired: number
  ): Promise<WDKTransferResult> {
    // Simulate network latency
    Logger.info('[WDK] DEMO — Simulating on-chain transfer...');
    await sleep(1500);

    const txHash = generateMockTxHash();

    const result: WDKTransferResult = {
      success:     true,
      txHash,
      explorerUrl: `https://mempool.space/tx/${txHash}`,
      amount:      request.amount,
      token:       request.token,
      fee:         WDK_TX_FEE_USDT,
      timestamp:   Date.now(),
      ethAddress:  ethAddress,
      collateralRequired: collateralRequired,
    };

    Logger.success('[WDK] DEMO Transfer confirmed', {
      txHash,
      ethAddress: ethAddress,
      borrowerBTC: request.recipientAddress,
      amount:    `${request.amount} ${request.token}`,
      collateral: `${collateralRequired.toFixed(8)} BTC required`,
    });

    return result;
  }
}

export default WDKClient;
