'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  Lock,
  Unlock,
  Bitcoin,
  Clock,
  Percent,
  ArrowUpRight,
} from 'lucide-react';
import { LoanRecord, LoanStatus } from '@/types';
import { Logger } from '@/utils/logger';

interface LoanHistoryProfileProps {
  btcAddress: string;
}

/**
 * LoanHistoryProfile
 * Component to display all loans for a user (active and historical)
 */
export const LoanHistoryProfile: React.FC<LoanHistoryProfileProps> = ({
  btcAddress,
}) => {
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'REPAID' | 'DEFAULTED'>('ALL');
  const [stats, setStats] = useState({
    totalBorrowed: 0,
    totalRepaid: 0,
    activeLoans: 0,
    defaultedLoans: 0,
  });
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [isRepayModalOpen, setIsRepayModalOpen] = useState(false);

  // Load loans on mount
  useEffect(() => {
    const loadLoans = async () => {
      try {
        setIsLoading(true);
        // Load real loans from localStorage first
        const realLoans: LoanRecord[] = JSON.parse(localStorage.getItem('loanHistory') || '[]');
        // Load demo loans as fallback if no real loans exist
        const demoLoans = realLoans.length > 0 ? [] : loadDemoLoans(btcAddress);
        // Merge and sort by date (newest first)
        const allLoans = [...realLoans, ...demoLoans].sort((a, b) => b.disbursedAt - a.disbursedAt);
        setLoans(allLoans);
        calculateStats(allLoans);
        Logger.info('[LoanHistoryProfile] Loans loaded', { btcAddress, realCount: realLoans.length, demoCount: demoLoans.length });
      } catch (error) {
        Logger.error('[LoanHistoryProfile] Failed to load loans', { error });
        // Fall back to demo loans if localStorage fails
        const demoLoans = loadDemoLoans(btcAddress);
        setLoans(demoLoans);
        calculateStats(demoLoans);
      } finally {
        setIsLoading(false);
      }
    };

    loadLoans();
  }, [btcAddress]);

  const calculateStats = (loanList: LoanRecord[]) => {
    const stats = {
      totalBorrowed: 0,
      totalRepaid: 0,
      activeLoans: 0,
      defaultedLoans: 0,
    };

    loanList.forEach((loan) => {
      stats.totalBorrowed += loan.amount;
      stats.totalRepaid += loan.amountRepaid || 0;
      if (loan.status === 'ACTIVE') stats.activeLoans++;
      if (loan.status === 'DEFAULTED') stats.defaultedLoans++;
    });

    setStats(stats);
  };

  const handleRepay = () => {
    if (!selectedLoan || !repayAmount) return;
    
    const amount = parseFloat(repayAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const remaining = selectedLoan.totalRepayment - selectedLoan.amountRepaid;
    if (amount > remaining) {
      alert(`Cannot pay more than remaining ${formatCurrency(remaining)}`);
      return;
    }

    // Update the loan
    const updatedLoan: LoanRecord = {
      ...selectedLoan,
      amountRepaid: selectedLoan.amountRepaid + amount,
      status: (selectedLoan.amountRepaid + amount >= selectedLoan.totalRepayment) ? 'REPAID' : 'ACTIVE',
    };

    // Update in loans array
    const updatedLoans = loans.map(l => l.id === selectedLoan.id ? updatedLoan : l);
    setLoans(updatedLoans);
    calculateStats(updatedLoans);

    // Save to localStorage
    try {
      const realLoans: LoanRecord[] = JSON.parse(localStorage.getItem('loanHistory') || '[]');
      const updated = realLoans.map(l => l.id === selectedLoan.id ? updatedLoan : l);
      localStorage.setItem('loanHistory', JSON.stringify(updated));
      Logger.info('Loan repayment processed', { loanId: selectedLoan.id, amount });
    } catch (error) {
      Logger.error('Failed to save repayment', { error });
    }

    // Close modal
    setIsRepayModalOpen(false);
    setSelectedLoan(null);
    setRepayAmount('');
  };

  const filteredLoans = loans.filter((loan) => {
    if (filter === 'ALL') return true;
    return loan.status === filter;
  });

  const getStatusColor = (status: LoanStatus) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent';
      case 'REPAID':
        return 'bg-cyber-green/20 text-cyber-green border-cyber-green';
      case 'DEFAULTED':
        return 'bg-red-950/30 text-red-400 border-red-600';
      case 'LIQUIDATED':
        return 'bg-orange-950/30 text-orange-400 border-orange-600';
      default:
        return 'bg-cyber-surface text-cyber-text border-cyber-border';
    }
  };

  const getStatusIcon = (status: LoanStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Clock className="w-4 h-4" />;
      case 'REPAID':
        return <CheckCircle className="w-4 h-4" />;
      case 'DEFAULTED':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="min-h-screen bg-cyber-void text-cyber-text">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="border-b border-cyber-border/30 bg-cyber-surface/40 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-cyber-surface rounded-lg transition-colors"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-cyber-text">Loan History</h1>
              <p className="text-cyber-muted font-mono text-sm">
                Bitcoin: {btcAddress.slice(0, 8)}...{btcAddress.slice(-6)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS CARDS ───────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Borrowed */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-cyber-surface border border-cyber-border/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-cyber-muted text-sm mb-2">
              <DollarSign className="w-4 h-4 text-cyber-gold" />
              <span>Total Borrowed</span>
            </div>
            <div className="text-2xl font-bold text-cyber-gold">
              ${formatCurrency(stats.totalBorrowed)}
            </div>
          </motion.div>

          {/* Total Repaid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-cyber-surface border border-cyber-border/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-cyber-muted text-sm mb-2">
              <CheckCircle className="w-4 h-4 text-cyber-green" />
              <span>Total Repaid</span>
            </div>
            <div className="text-2xl font-bold text-cyber-green">
              ${formatCurrency(stats.totalRepaid)}
            </div>
          </motion.div>

          {/* Active Loans */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-cyber-surface border border-cyber-border/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-cyber-muted text-sm mb-2">
              <Clock className="w-4 h-4 text-cyber-accent" />
              <span>Active Loans</span>
            </div>
            <div className="text-2xl font-bold text-cyber-accent">{stats.activeLoans}</div>
          </motion.div>

          {/* Defaulted */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-cyber-surface border border-cyber-border/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2 text-cyber-muted text-sm mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>Defaulted</span>
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.defaultedLoans}</div>
          </motion.div>
        </div>

        {/* ── FILTER BUTTONS ────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['ALL', 'ACTIVE', 'REPAID', 'DEFAULTED'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                filter === f
                  ? 'bg-cyber-accent text-black font-bold'
                  : 'bg-cyber-surface border border-cyber-border/30 hover:border-cyber-accent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── LOANS LIST ────────────────────────────────────────── */}
        {isLoading ? (
          <div className="text-center py-12 text-cyber-muted">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border border-cyber-accent"></div>
            <p className="mt-4">Loading loans...</p>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="text-center py-12 text-cyber-muted">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No {filter !== 'ALL' ? filter.toLowerCase() : ''} loans found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="wait">
              {filteredLoans.map((loan, idx) => (
                <motion.div
                  key={loan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-cyber-surface border border-cyber-border/30 rounded-lg p-5 hover:border-cyber-accent/50 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Loan Details */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-bold text-lg">
                            {loan.amount.toLocaleString('en-US')} {loan.token}
                          </h3>
                          <p className="text-cyber-muted text-sm font-mono">ID: {loan.id.slice(0, 12)}...</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full border text-sm font-mono flex items-center gap-2 ${getStatusColor(
                            loan.status
                          )}`}
                        >
                          {getStatusIcon(loan.status)}
                          {loan.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-cyber-muted">
                          <Percent className="w-4 h-4 text-cyan-400" />
                          <span>APR: <span className="text-cyan-400 font-bold">{loan.aprPercent}%</span></span>
                        </div>
                        <div className="flex items-center gap-2 text-cyber-muted">
                          <Calendar className="w-4 h-4 text-cyber-gold" />
                          <span>{loan.durationDays}d term</span>
                        </div>
                      </div>

                      <div className="text-sm">
                        <p className="text-cyber-muted mb-1">Borrowed</p>
                        <p className="text-cyber-gold font-bold">{formatDate(loan.disbursedAt)}</p>
                      </div>
                    </div>

                    {/* Right: Repayment & Collateral */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-cyber-void/50 rounded p-3">
                          <p className="text-cyber-muted text-xs">Total Due</p>
                          <p className="text-cyber-text font-bold">
                            ${formatCurrency(loan.totalRepayment)}
                          </p>
                        </div>
                        <div className="bg-cyber-void/50 rounded p-3">
                          <p className="text-cyber-muted text-xs">Repaid</p>
                          <p className="text-cyber-green font-bold">
                            ${formatCurrency(loan.amountRepaid)}
                          </p>
                        </div>
                      </div>

                      {/* Collateral Info */}
                      {loan.collateralWBTC && (
                        <div className="bg-cyber-void/50 rounded p-3 border border-cyber-border/20">
                          <div className="flex items-center gap-2 text-xs text-cyber-muted mb-1">
                            <Lock className="w-3 h-3" />
                            <span>Collateral (Escrowed)</span>
                          </div>
                          <p className="text-cyber-text font-bold">
                            {loan.collateralWBTC.toFixed(6)} WBTC
                          </p>
                          {loan.collateralReleasedAt && (
                            <p className="text-cyber-muted text-xs mt-1">
                              Released: {formatDate(loan.collateralReleasedAt)}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="text-sm">
                        <p className="text-cyber-muted mb-1">Due Date</p>
                        <p className="text-cyber-accent font-bold">{formatDate(loan.dueAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Info */}
                  {loan.status === 'ACTIVE' && (
                    <div className="mt-4 pt-4 border-t border-cyber-border/20">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-cyber-muted">
                          ⚠️ Payment due in{' '}
                          <span className="text-cyber-accent">
                            {Math.max(0, Math.floor((loan.dueAt - Date.now()) / 86400000))} days
                          </span>
                        </p>
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setRepayAmount('');
                            setIsRepayModalOpen(true);
                          }}
                          className="px-4 py-2 bg-cyber-accent/20 hover:bg-cyber-accent/30 text-cyber-accent border border-cyber-accent rounded font-mono text-sm transition-colors"
                        >
                          💳 Repay
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── REPAY MODAL ────────────────────────────────────────── */}
        <AnimatePresence>
          {isRepayModalOpen && selectedLoan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setIsRepayModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-cyber-surface border border-cyber-accent rounded-lg p-6 w-full max-w-md"
              >
                <h2 className="text-2xl font-bold text-cyber-text mb-4">Repay Loan</h2>
                
                <div className="space-y-4">
                  {/* Loan Info */}
                  <div className="bg-cyber-void/50 rounded p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted">Loan Amount</span>
                      <span className="text-cyber-gold font-bold">${formatCurrency(selectedLoan.amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted">Total Due</span>
                      <span className="text-cyber-text font-bold">${formatCurrency(selectedLoan.totalRepayment)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cyber-muted">Already Repaid</span>
                      <span className="text-cyber-green font-bold">${formatCurrency(selectedLoan.amountRepaid)}</span>
                    </div>
                    <div className="border-t border-cyber-border/20 pt-2 flex justify-between text-sm">
                      <span className="text-cyber-muted">Remaining</span>
                      <span className="text-cyber-accent font-bold">
                        ${formatCurrency(selectedLoan.totalRepayment - selectedLoan.amountRepaid)}
                      </span>
                    </div>
                  </div>

                  {/* Repay Form */}
                  <div>
                    <label className="block text-sm font-mono text-cyber-muted mb-2">
                      Repayment Amount (USD₮)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={selectedLoan.totalRepayment - selectedLoan.amountRepaid}
                      step="0.01"
                      value={repayAmount}
                      onChange={(e) => setRepayAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-cyber-void border border-cyber-border rounded px-3 py-2 text-cyber-text font-mono placeholder-cyber-muted/50 focus:border-cyber-accent focus:outline-none"
                    />
                  </div>

                  {/* Quick buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[0.25, 0.5, 1.0].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => {
                          const remaining = selectedLoan.totalRepayment - selectedLoan.amountRepaid;
                          const amount = remaining * ratio;
                          setRepayAmount(amount.toFixed(2));
                        }}
                        className="px-2 py-1 bg-cyber-border/30 hover:bg-cyber-border/50 text-cyber-text rounded text-xs font-mono transition-colors"
                      >
                        {(ratio * 100).toFixed(0)}%
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setIsRepayModalOpen(false)}
                      className="flex-1 px-4 py-2 bg-cyber-border/20 hover:bg-cyber-border/30 text-cyber-text rounded transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRepay}
                      disabled={!repayAmount || parseFloat(repayAmount) <= 0}
                      className="flex-1 px-4 py-2 bg-cyber-accent/20 hover:bg-cyber-accent/30 disabled:opacity-50 disabled:cursor-not-allowed text-cyber-accent border border-cyber-accent rounded font-mono transition-colors"
                    >
                      Repay Now
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── DEMO DATA ──────────────────────────────────────────────────
function loadDemoLoans(btcAddress: string): LoanRecord[] {
  const now = Date.now();
  return [
    {
      id: 'loan_001_active',
      btcAddress,
      amount: 2300,
      token: 'USDt',
      aprPercent: 8.5,
      durationDays: 30,
      totalRepayment: 2419.25,
      disbursedAt: now - 10 * 86400000, // 10 days ago
      dueAt: now + 20 * 86400000, // 20 days from now
      status: 'ACTIVE',
      txHashDisbursement: `0x${Math.random().toString(16).slice(2)}`,
      amountRepaid: 0,
      creditScore: 78,
      reasoning: 'Strong BTC holdings, 6+ months history',
      agentReasoningLog: ['Verified Bitcoin address', 'Checked Intercom signals', 'Approved 8.5% APR'],
      collateralWBTC: 0.006,
      collateralContractAddress: '0xCollateralEscrow...',
      collateralLockTxHash: `0x${Math.random().toString(16).slice(2)}`,
    },
    {
      id: 'loan_002_repaid',
      btcAddress,
      amount: 5000,
      token: 'USDt',
      aprPercent: 7.8,
      durationDays: 45,
      totalRepayment: 5433.33,
      disbursedAt: now - 60 * 86400000, // 60 days ago
      dueAt: now - 15 * 86400000, // 15 days ago (already due)
      status: 'REPAID',
      txHashDisbursement: `0x${Math.random().toString(16).slice(2)}`,
      txHashRepayment: `0x${Math.random().toString(16).slice(2)}`,
      amountRepaid: 5433.33,
      creditScore: 82,
      reasoning: 'Excellent repayment history',
      agentReasoningLog: ['On-time repayment', 'No defaults'],
      collateralWBTC: 0.013,
      collateralContractAddress: '0xCollateralEscrow...',
      collateralLockTxHash: `0x${Math.random().toString(16).slice(2)}`,
      collateralReleaseReason: 'repaid',
      collateralReleasedAt: now - 15 * 86400000,
    },
    {
      id: 'loan_003_partial',
      btcAddress,
      amount: 1500,
      token: 'XAUt',
      aprPercent: 9.5,
      durationDays: 60,
      totalRepayment: 1737.5,
      disbursedAt: now - 35 * 86400000,
      dueAt: now + 25 * 86400000,
      status: 'ACTIVE',
      txHashDisbursement: `0x${Math.random().toString(16).slice(2)}`,
      amountRepaid: 869.375, // 50% repaid
      creditScore: 75,
      reasoning: 'Moderate BTC balance',
      agentReasoningLog: ['Making regular payments'],
      collateralWBTC: 0.004,
      collateralContractAddress: '0xCollateralEscrow...',
    },
  ];
}

export default LoanHistoryProfile;
