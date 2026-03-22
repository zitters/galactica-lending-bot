// 
// src/wallet/WDKClient.ts  Tether Wallet Dev Kit Integration (WDK SDK + Aave)
// Updated to use official WDK modules and WDK lending module for Aave
// 

import WDK from '@tetherto/wdk';
import WalletManagerEvm from '@tetherto/wdk-wallet-evm';
import WalletManagerBtc from '@tetherto/wdk-wallet-btc';
import AaveProtocolEvm from '@tetherto/wdk-protocol-lending-aave-evm';

import {
  WDKTransferRequest,
  WDKTransferResult,
  WalletBalance,
  LoanToken,
  YieldPosition,
} from '@/types';
import Logger from '@/utils/logger';

const WDK_TX_FEE_USDT = 0.50; // Approximate fee for audit telemetry

const USDT_CONTRACT = process.env.USDT_CONTRACT_ADDRESS ?? '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const XAUT_CONTRACT = process.env.XAUT_CONTRACT_ADDRESS ?? '0x58b6a8a3302369daec383334672404ee733ab239';

export class WDKClient {
  private static wdk: any | null = null;
  private static seedPhrase: string | null = null;

  private static async ensureInit(): Promise<void> {
    if (this.wdk) {
      return;
    }

    this.seedPhrase = process.env.WDK_SEED_PHRASE ?? WDK.getRandomSeedPhrase();

    this.wdk = new WDK(this.seedPhrase)
      .registerWallet('ethereum', WalletManagerEvm, {
        provider: process.env.ETH_RPC_URL ?? 'https://eth-mainnet.public.blastapi.io',
        transferMaxFee: parseInt(process.env.WDK_ETH_MAX_FEE ?? '200000000000000', 10),
      })
      .registerWallet('bitcoin', WalletManagerBtc as any, {
        network: process.env.BTC_NETWORK ?? 'bitcoin',
        host: process.env.BTC_ELECTRUM_HOST ?? 'electrum.blockstream.info',
        port: parseInt(process.env.BTC_ELECTRUM_PORT ?? '50001', 10),
        protocol: process.env.BTC_ELECTRUM_PROTOCOL ?? 'tcp',
      });

    try {
      this.wdk.registerProtocol('ethereum', 'aave', AaveProtocolEvm, {
        poolAddressProvider: process.env.AAVE_POOL_ADDRESS_PROVIDER ?? '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
      });
    } catch (err) {
      Logger.warn('[WDK] Could not register Aave protocol module', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    Logger.success('[WDK] Initialized', { seedPhrase: !!this.seedPhrase });
  }

  private static toTokenAmount(amount: number, decimals: number): bigint {
    return BigInt(Math.floor(amount * Math.pow(10, decimals)));
  }

  private static fromTokenAmount(amount: bigint, decimals: number): number {
    return Number(amount) / Math.pow(10, decimals);
  }

  static async getBalance(): Promise<WalletBalance> {
    await this.ensureInit();

    if (process.env.DEMO_MODE === 'true') {
      return this.getDemoBalance();
    }

    try {
      const ethAccount = await this.wdk.getAccount('ethereum', 0);
      const btcAccount = await this.wdk.getAccount('bitcoin', 0);

      const usdtRaw = await ethAccount.getTokenBalance(USDT_CONTRACT);
      const xautRaw = await ethAccount.getTokenBalance(XAUT_CONTRACT);
      const btcSats = await btcAccount.getBalance();

      const balance: WalletBalance = {
        USDt: this.fromTokenAmount(BigInt(usdtRaw), 6),
        XAUt: this.fromTokenAmount(BigInt(xautRaw), 6),
        BTC: Number(btcSats) / 1e8,
        lastUpdated: Date.now(),
      };

      Logger.info('[WDK] Balances retrieved via WDK SDK', balance as unknown as Record<string, unknown>);
      return balance;
    } catch (err) {
      Logger.error('[WDK] Failed to fetch balance from WDK SDK', {
        error: err instanceof Error ? err.message : String(err),
      });
      return this.getDemoBalance();
    }
  }

  static async sendFunds(request: WDKTransferRequest): Promise<WDKTransferResult> {
    await this.ensureInit();

    const ethAccount = await this.wdk.getAccount('ethereum', 0);
    const recipientAddress = process.env.AGENT_ETH_WITHDRAW_ADDRESS ?? request.recipientAddress;

    try {
      const tokenAddress = request.token === 'USDt' ? USDT_CONTRACT : XAUT_CONTRACT;
      const amountBase = this.toTokenAmount(request.amount, 6);

      Logger.info('[WDK] Sending funds via WDK SDK', {
        borrowerBTCAddress: request.recipientAddress,
        destinationEvmAddress: recipientAddress,
        amount: request.amount,
        token: request.token,
        loanId: request.loanId,
      });

      const transferResult = await ethAccount.transfer({
        token: tokenAddress,
        recipient: recipientAddress,
        amount: amountBase,
      });

      const txHash = transferResult.hash ?? transferResult.txHash ?? '';
      const feeWei = BigInt(transferResult.fee ?? 0);

      return {
        success: true,
        txHash,
        explorerUrl: `${process.env.ETH_EXPLORER_URL ?? 'https://etherscan.io/tx'}/${txHash}`,
        amount: request.amount,
        token: request.token,
        fee: Number(feeWei) / 1e6,
        timestamp: Date.now(),
        ethAddress: recipientAddress,
        collateralRequired: 0,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      Logger.error('[WDK] Transfer failed via SDK', { error });
      return {
        success: false,
        amount: request.amount,
        token: request.token,
        fee: 0,
        timestamp: Date.now(),
        error,
      };
    }
  }

  static async verifyRepayment(txHash: string, expectedAmount: number): Promise<{confirmed:boolean; amount:number; confirmations:number;}> {
    await this.ensureInit();

    if (process.env.DEMO_MODE === 'true') {
      return { confirmed: true, amount: expectedAmount, confirmations: 6 };
    }

    try {
      const btcAccount = await this.wdk.getAccount('bitcoin', 0);
      const tx: any = await btcAccount.getTransaction(txHash);
      const confirmed = tx?.confirmations >= 1;
      const amount = Number(tx?.value ?? 0) / 1e8;
      return { confirmed, amount, confirmations: tx?.confirmations ?? 0 };
    } catch (err) {
      Logger.warn('[WDK] Could not verify repayment tx via WDK SDK', {
        txHash,
        error: err instanceof Error ? err.message : String(err),
      });
      return { confirmed: false, amount: 0, confirmations: 0 };
    }
  }

  static async scanIncomingTx(since: number): Promise<Array<{txHash:string; from:string; amount:number; token:LoanToken; timestamp:number; memo?:string;}>> {
    await this.ensureInit();

    if (process.env.DEMO_MODE === 'true') {
      return [];
    }

    try {
      const btcAccount = await this.wdk.getAccount('bitcoin', 0);
      const transfers = await btcAccount.getTransfers({ direction: 'incoming', limit: 100 });
      return transfers
        .filter((t: any) => (t.timestamp ?? Date.now()) > since)
        .map((t: any) => ({
          txHash: t.txid ?? t.hash,
          from: t.from ?? '',
          amount: Number(t.value ?? 0) / 1e8,
          token: 'BTC',
          timestamp: Number(t.timestamp ?? Date.now()),
          memo: t.memo,
        }));
    } catch (err) {
      Logger.error('[WDK] scanIncomingTx failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  static async stakeToYield(amount: number, token: LoanToken): Promise<{success:boolean; position?:YieldPosition; error?:string;}> {
    await this.ensureInit();

    if (process.env.DEMO_MODE === 'true') {
      const position: YieldPosition = {
        poolAddress: process.env.YIELD_POOL_ADDRESS ?? '0xAAVE_POOL',
        amount,
        token,
        apy: parseFloat(process.env.YIELD_MIN_APY ?? '3.5'),
        enteredAt: Date.now(),
        currentValue: amount,
        earned: 0,
      };
      Logger.success('[WDK] Yield position opened (DEMO)', { amount, token });
      return { success: true, position };
    }

    try {
      const ethAccount = await this.wdk.getAccount('ethereum', 0);
      const aave = new AaveProtocolEvm(ethAccount);
      const amountBase = this.toTokenAmount(amount, 6);
      const supplyResult = await aave.supply({ token: USDT_CONTRACT, amount: amountBase });

      const position: YieldPosition = {
        poolAddress: process.env.AAVE_POOL_ADDRESS_PROVIDER ?? 'aave-v3',
        amount,
        token,
        apy: parseFloat(process.env.AAVE_ESTIMATED_APY ?? '4.25'),
        enteredAt: Date.now(),
        currentValue: amount,
        earned: 0,
      };

      Logger.success('[WDK] Aave yield position opened', { supplyResult, amount, token });
      return { success: true, position };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      Logger.error('[WDK] Aave stakeToYield failed', { error });
      return { success: false, error };
    }
  }

  private static getDemoBalance(): WalletBalance {
    return {
      USDt: parseFloat(process.env.AGENT_TREASURY_USDT ?? '50000'),
      XAUt: parseFloat(process.env.AGENT_TREASURY_XAUT ?? '10'),
      BTC: parseFloat(process.env.AGENT_TREASURY_BTC ?? '2.5'),
      lastUpdated: Date.now(),
    };
  }
}

export default WDKClient;
