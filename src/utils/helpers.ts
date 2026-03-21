// ═══════════════════════════════════════════════════════════════
// src/utils/helpers.ts — Utility Functions
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════

import { LoanToken, RiskTier } from '@/types';

/**
 * Format USD value with commas
 */
export function formatUSD(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format BTC value
 */
export function formatBTC(value: number): string {
  return `${value.toFixed(8)} BTC`;
}

/**
 * Format token amount
 */
export function formatToken(amount: number, token: LoanToken): string {
  if (token === 'XAUt') {
    return `${amount.toFixed(4)} XAUt`;
  }
  return `${amount.toFixed(2)} USDt`;
}

/**
 * Calculate total repayment
 */
export function calculateRepayment(
  principal: number,
  aprPercent: number,
  durationDays: number
): { totalRepayment: number; dailyInterest: number; totalInterest: number; dailyRepayment: number } {
  const dailyRate   = aprPercent / 100 / 365;
  const totalInterest = principal * dailyRate * durationDays;
  const totalRepayment = principal + totalInterest;
  const dailyInterest  = totalInterest / durationDays;
  const dailyRepayment = totalRepayment / durationDays;

  return {
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    dailyInterest:  Math.round(dailyInterest  * 10000) / 10000,
    totalInterest:  Math.round(totalInterest  * 100) / 100,
    dailyRepayment: Math.round(dailyRepayment * 100) / 100,
  };
}

/**
 * Truncate a Bitcoin address for display
 */
export function truncateAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Validate basic Bitcoin address format
 */
export function isValidBitcoinAddress(address: string): boolean {
  // Legacy P2PKH: starts with 1
  const p2pkh = /^1[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  // P2SH: starts with 3
  const p2sh  = /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/;
  // Bech32 (P2WPKH / P2WSH): starts with bc1
  const bech32 = /^bc1[a-z0-9]{6,87}$/;
  // Testnet
  const testnet = /^(tb1|[mn2])[a-zA-HJ-NP-Z0-9]{25,87}$/;

  return p2pkh.test(address) || p2sh.test(address) || bech32.test(address) || testnet.test(address);
}

/**
 * Get APR range from risk tier
 */
export function getAPRFromTier(tier: RiskTier): [number, number] {
  switch (tier) {
    case 'LOW':      return [3, 6];
    case 'MODERATE': return [10, 14];
    case 'HIGH':     return [18, 24];
    case 'REJECT':   return [0, 0];
  }
}

/**
 * Get max loan amount from risk tier
 */
export function getMaxLoanFromTier(tier: RiskTier): number {
  switch (tier) {
    case 'LOW':      return 5000;
    case 'MODERATE': return 1000;
    case 'HIGH':     return 300;
    case 'REJECT':   return 0;
  }
}

/**
 * Convert BTC amount to USD (with a mock price fallback)
 */
export function btcToUSD(btcAmount: number, btcPrice = 65000): number {
  return btcAmount * btcPrice;
}

/**
 * Generate a random transaction hash for demo
 */
export function generateMockTxHash(): string {
  const chars = '0123456789abcdef';
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse with fallback
 */
export function safeJSONParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format duration in days to human readable
 */
export function formatDuration(days: number): string {
  if (days < 7)  return `${days} day${days !== 1 ? 's' : ''}`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''}`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
}

/**
 * Check if a timestamp is expired
 */
export function isExpired(timestamp: number): boolean {
  return Date.now() > timestamp;
}
