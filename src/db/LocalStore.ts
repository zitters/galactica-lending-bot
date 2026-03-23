// ═══════════════════════════════════════════════════════════════
// src/db/LocalStore.ts — Persistent Loan Store (lowdb / JSON)
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════

import { Low } from 'lowdb';
import { JSONFilePreset } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';
import { LoanRecord, LoanStatus, LoanToken } from '@/types';
import Logger from '@/utils/logger';
import path from 'path';

interface DBSchema {
  loans:     LoanRecord[];
  interAgentLoans: Array<{
    id: string;
    borrowedFrom: string;
    amount: number;
    token: LoanToken;
    apr: number;
    borrowedAt: number;
    dueAt: number;
    status: 'ACTIVE' | 'REPAID' | 'DEFAULTED';
  }>;
  blacklist: string[];   // BTC addresses
  metadata: {
    totalDisbursed: number;
    totalRepaid:    number;
    createdAt:      number;
    lastUpdated:    number;
  };
}

const DEFAULT_DB: DBSchema = {
  loans:    [],
  interAgentLoans: [],
  blacklist: [],
  metadata: {
    totalDisbursed: 0,
    totalRepaid:    0,
    createdAt:      Date.now(),
    lastUpdated:    Date.now(),
  },
};

let db: Low<DBSchema> | null = null;

async function getDB(): Promise<Low<DBSchema>> {
  if (!db) {
    const dbPath = path.resolve(process.env.DB_PATH ?? './data/loans.json');
    db = await JSONFilePreset<DBSchema>(dbPath, DEFAULT_DB);
  }
  return db;
}

export class LocalStore {
  static async saveLoan(
    btcAddress: string,
    amount: number,
    token: LoanToken,
    aprPercent: number,
    durationDays: number,
    totalRepayment: number,
    txHash: string,
    creditScore: number,
    reasoning: string
  ): Promise<LoanRecord> {
    const store = await getDB();
    const now   = Date.now();

    const loan: LoanRecord = {
      id:                   uuidv4(),
      btcAddress,
      amount,
      token,
      aprPercent,
      durationDays,
      totalRepayment,
      disbursedAt:          now,
      dueAt:                now + durationDays * 86400000,
      status:               'ACTIVE',
      txHashDisbursement:   txHash,
      amountRepaid:         0,
      creditScore,
      reasoning,
      agentReasoningLog:    [
        `[${new Date(now).toISOString()}] Loan disbursed via WDK. TX: ${txHash}`,
        `[${new Date(now).toISOString()}] Credit score at disbursement: ${creditScore}/100`,
      ],
    };

    await store.update(data => {
      data.loans.push(loan);
      data.metadata.totalDisbursed  += amount;
      data.metadata.lastUpdated      = Date.now();
    });

    Logger.success('[LocalStore] Loan saved', { id: loan.id, btcAddress, amount, token });
    return loan;
  }

  static async getLoan(loanId: string): Promise<LoanRecord | null> {
    const store = await getDB();
    return store.data.loans.find(l => l.id === loanId) ?? null;
  }

  static async getActiveLoansByAddress(btcAddress: string): Promise<LoanRecord[]> {
    const store = await getDB();
    return store.data.loans.filter(
      l => l.btcAddress === btcAddress && l.status === 'ACTIVE'
    );
  }

  static async getAllActiveLoans(): Promise<LoanRecord[]> {
    const store = await getDB();
    return store.data.loans.filter(l => l.status === 'ACTIVE');
  }

  static async getAllLoans(): Promise<LoanRecord[]> {
    const store = await getDB();
    return [...store.data.loans];
  }

  static async updateLoanStatus(
    loanId: string,
    status: LoanStatus,
    update: Partial<Pick<LoanRecord, 'amountRepaid' | 'txHashRepayment'>> = {}
  ): Promise<boolean> {
    const store = await getDB();
    const loan  = store.data.loans.find(l => l.id === loanId);
    if (!loan) return false;

    loan.status = status;
    if (update.amountRepaid !== undefined) loan.amountRepaid     = update.amountRepaid;
    if (update.txHashRepayment)            loan.txHashRepayment  = update.txHashRepayment;

    loan.agentReasoningLog.push(
      `[${new Date().toISOString()}] Status updated to ${status}. ${JSON.stringify(update)}`
    );

    if (status === 'REPAID') {
      store.data.metadata.totalRepaid += loan.amount;
    }
    store.data.metadata.lastUpdated = Date.now();

    await store.write();
    Logger.info('[LocalStore] Loan status updated', { loanId, status });
    return true;
  }

  static async addToBlacklist(btcAddress: string): Promise<void> {
    const store = await getDB();
    if (!store.data.blacklist.includes(btcAddress)) {
      await store.update(data => {
        data.blacklist.push(btcAddress);
        data.metadata.lastUpdated = Date.now();
      });
      Logger.warn('[LocalStore] Address blacklisted', { btcAddress });
    }
  }

  static async isBlacklisted(btcAddress: string): Promise<boolean> {
    const store = await getDB();
    return store.data.blacklist.includes(btcAddress);
  }

  static async getStats(): Promise<DBSchema['metadata'] & {
    activeLoans:  number;
    defaultedLoans: number;
    repaidLoans:  number;
  }> {
    const store = await getDB();
    const { loans, metadata } = store.data;
    return {
      ...metadata,
      activeLoans:    loans.filter(l => l.status === 'ACTIVE').length,
      defaultedLoans: loans.filter(l => l.status === 'DEFAULTED').length,
      repaidLoans:    loans.filter(l => l.status === 'REPAID').length,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // INTER-AGENT LOANS
  // ─────────────────────────────────────────────────────────────

  static async saveInterAgentLoan(loan: {
    id: string;
    borrowedFrom: string;
    amount: number;
    token: LoanToken;
    apr: number;
    borrowedAt: number;
    dueAt: number;
    status: 'ACTIVE' | 'REPAID' | 'DEFAULTED';
  }): Promise<void> {
    const store = await getDB();
    await store.update(data => {
      data.interAgentLoans.push(loan);
      data.metadata.lastUpdated = Date.now();
    });
    Logger.info('[LocalStore] Inter-agent loan saved', { id: loan.id, borrowedFrom: loan.borrowedFrom, amount: loan.amount });
  }

  static async updateInterAgentLoanStatus(
    loanId: string,
    status: 'ACTIVE' | 'REPAID' | 'DEFAULTED'
  ): Promise<boolean> {
    const store = await getDB();
    const loan = store.data.interAgentLoans.find(l => l.id === loanId);
    if (!loan) return false;

    loan.status = status;
    store.data.metadata.lastUpdated = Date.now();

    await store.write();
    Logger.info('[LocalStore] Inter-agent loan status updated', { loanId, status });
    return true;
  }

  static async getActiveInterAgentLoans(): Promise<DBSchema['interAgentLoans']> {
    const store = await getDB();
    return store.data.interAgentLoans.filter(l => l.status === 'ACTIVE');
  }
}

export default LocalStore;
