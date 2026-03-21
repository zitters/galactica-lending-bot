'use client';

// ═══════════════════════════════════════════════════════════════
// src/ui/LendingDashboard.tsx — Cyber-DeFi Interactive Demo
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════
//
// 5-Step fully animated demonstration:
//   Step 1: Identity Connection (BTC Sign)
//   Step 2: Intercom Data Scan (Terminal animation)
//   Step 3: Credit Dashboard (Gauge + Stats)
//   Step 4: AI Chat Negotiator
//   Step 5: WDK Settlement (Progress + TX Hash)
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logger } from '@/utils/logger';
import type { LoanRecord } from '@/types';
import {
  Bitcoin, Shield, Zap, TrendingUp, Wallet, MessageSquare,
  CheckCircle, AlertTriangle, XCircle, Loader2, ExternalLink,
  Activity, Database, Cpu, Lock, Send, ChevronRight,
  DollarSign, Coins, BarChart3, Globe, ArrowRight, RefreshCw,
  Star, Award, Clock
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
interface ScanLog    { text: string; type: 'info' | 'data' | 'ai' | 'success' | 'error'; }
interface ChatMsg    { role: 'ai' | 'user'; content: string; timestamp: Date; }
interface CreditData {
  score:      number;
  tier:       'LOW' | 'MODERATE' | 'HIGH' | 'REJECT';
  btcBalance: number;
  txCount:    number;
  aprRange:   [number, number];
  maxLoan:    number;
  reasoning:  string;
  tapTokens:  Array<{ ticker: string; amount: number; usdValue: number }>;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;

// ── Demo Config ───────────────────────────────────────────────
const DEMO_BTC_ADDRESS = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
const AGENT_TREASURY   = 50_000;
const ACTIVE_LOANS     = 12;
const DEMO_TX_HASH     = 'a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1';

const SCAN_LOGS: ScanLog[] = [
  { text: '[INFO] Initializing Trac Intercom Protocol connection...', type: 'info' },
  { text: '[INFO] Connecting to indexer nodes: trac.network/indexer-1, indexer-2...', type: 'info' },
  { text: '[DATA] Node sync status: ✓ Block 845,231 (100% synced)', type: 'data' },
  { text: '[INFO] Querying BTC on-chain history for bc1qxy...x0wlh', type: 'info' },
  { text: '[DATA] 1,420 BTC transactions found across 72 months.', type: 'data' },
  { text: '[DATA] BTC Balance: 2.5000 BTC ($162,500 USD)', type: 'data' },
  { text: '[DATA] Last activity: 2 days ago. First seen: Jan 2019.', type: 'data' },
  { text: '[INFO] Fetching TAP Protocol token balances...', type: 'info' },
  { text: '[DATA] $TRAC: 4,250 tokens (≈$2,125 USD) — Premium holder!', type: 'data' },
  { text: '[DATA] $NAT: 1,800 tokens (≈$180 USD)', type: 'data' },
  { text: '[INFO] Querying cross-agent reputation signals...', type: 'info' },
  { text: '[DATA] 1 positive signal from DeFi-Agent-Alpha: Loan of 500 USDt repaid on time.', type: 'data' },
  { text: '[AI] Running weighted scoring algorithm...', type: 'ai' },
  { text: '[AI] Balance score:    35/40 pts (2.5 BTC balance)', type: 'ai' },
  { text: '[AI] Activity score:   36/40 pts (72 months, 1,420 txs)', type: 'ai' },
  { text: '[AI] Asset score:      12/20 pts ($TRAC premium holder)', type: 'ai' },
  { text: '[AI] Reputation bonus: +3 pts (1 repaid signal)', type: 'ai' },
  { text: '[AI] ════════════════════════════════', type: 'ai' },
  { text: '[AI] Risk score calculated: 87/100 — LOW RISK ✅', type: 'success' },
  { text: '[AI] Eligible APR: 4–6% | Max loan: $5,000 USDt', type: 'success' },
];

// ── Helper Components ─────────────────────────────────────────

function CyberCard({ children, className = '', glow = false }: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={`
      bg-cyber-card border border-cyber-border rounded-xl
      ${glow ? 'shadow-cyber border-cyber-accent/30' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  const steps = [
    { icon: Bitcoin,     label: 'Identity'   },
    { icon: Database,    label: 'Intercom'   },
    { icon: BarChart3,   label: 'Score'      },
    { icon: MessageSquare, label: 'Negotiate' },
    { icon: Wallet,      label: 'Settle'     },
  ];

  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {steps.map((step, i) => {
        const StepIcon = step.icon;
        const stepNum  = (i + 1) as Step;
        const isDone   = current > stepNum;
        const isActive = current === stepNum;

        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                  ${isDone   ? 'bg-cyber-green/20 border-cyber-green text-cyber-green' : ''}
                  ${isActive ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent shadow-cyber' : ''}
                  ${!isDone && !isActive ? 'bg-cyber-surface border-cyber-border text-cyber-muted' : ''}
                `}
                animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isDone ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-4 h-4" />
                )}
              </motion.div>
              <span className={`text-[10px] font-mono hidden sm:block ${isActive ? 'text-cyber-accent' : isDone ? 'text-cyber-green' : 'text-cyber-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`
                h-0.5 w-8 sm:w-12 mb-4 transition-all
                ${current > stepNum ? 'bg-cyber-green' : 'bg-cyber-border'}
              `} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Score Gauge ───────────────────────────────────────────────
function ScoreGauge({ score, tier }: { score: number; tier: string }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius        = 90;
  const circumference = 2 * Math.PI * radius;
  const dash          = (displayScore / 100) * circumference * 0.75;
  const gap           = circumference - dash;

  useEffect(() => {
    const timer = setTimeout(() => {
      let n = 0;
      const interval = setInterval(() => {
        n = Math.min(n + 2, score);
        setDisplayScore(n);
        if (n >= score) clearInterval(interval);
      }, 20);
      return () => clearInterval(interval);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  const color = score >= 85 ? '#00FF9F' : score >= 60 ? '#F5A623' : '#FF4444';
  const tierColors: Record<string, string> = {
    LOW:      'text-cyber-green',
    MODERATE: 'text-cyber-gold',
    HIGH:     'text-cyber-red',
    REJECT:   'text-cyber-red',
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg width="220" height="220" viewBox="0 0 220 220">
        {/* Background ring */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none" stroke="#1F2D3D" strokeWidth="14"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={circumference * 0.125}
          strokeLinecap="round"
        />
        {/* Score ring */}
        <motion.circle
          cx="110" cy="110" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeDasharray={`${dash} ${gap + circumference * 0.25}`}
          strokeDashoffset={circumference * 0.125}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          initial={{ strokeDasharray: `0 ${circumference}` }}
        />
        {/* Glow pulse circles */}
        {[1, 2].map(i => (
          <circle
            key={i}
            cx="110" cy="110" r={radius - 4 + i * 8}
            fill="none"
            stroke={color}
            strokeWidth="1"
            opacity={0.1}
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeDashoffset={circumference * 0.125}
          />
        ))}
      </svg>
      {/* Center text */}
      <div className="absolute text-center">
        <motion.div
          className="font-mono font-bold"
          style={{ fontSize: '3rem', color, lineHeight: 1 }}
        >
          {displayScore}
        </motion.div>
        <div className="text-cyber-muted text-sm font-mono">/ 100</div>
        <div className={`text-xs font-bold mt-1 font-mono ${tierColors[tier] ?? 'text-cyber-muted'}`}>
          {tier} RISK
        </div>
      </div>
    </div>
  );
}

// ── Chat Message ──────────────────────────────────────────────
function ChatBubble({ msg }: { msg: ChatMsg }) {
  const isAI = msg.role === 'ai';
  return (
    <motion.div
      className={`flex ${isAI ? 'justify-start' : 'justify-end'} mb-3`}
      initial={{ opacity: 0, x: isAI ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {isAI && (
        <div className="w-8 h-8 rounded-full bg-cyber-accent/20 border border-cyber-accent/40 flex items-center justify-center mr-2 mt-auto mb-1 flex-shrink-0">
          <Cpu className="w-4 h-4 text-cyber-accent" />
        </div>
      )}
      <div className={`
        max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed
        ${isAI
          ? 'bg-cyber-surface border border-cyber-accent/20 text-cyber-text'
          : 'bg-cyber-accent/10 border border-cyber-accent/40 text-cyber-accent'
        }
      `}>
        <div className="whitespace-pre-wrap font-sans text-sm">{msg.content}</div>
        <div className="text-[10px] text-cyber-muted mt-1 font-mono text-right">
          {msg.timestamp.toLocaleTimeString('en-US')}
        </div>
      </div>
      {!isAI && (
        <div className="w-8 h-8 rounded-full bg-cyber-purple/20 border border-cyber-purple/40 flex items-center justify-center ml-2 mt-auto mb-1 flex-shrink-0">
          <Bitcoin className="w-4 h-4 text-cyber-purple" />
        </div>
      )}
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-8 h-8 rounded-full bg-cyber-accent/20 border border-cyber-accent/40 flex items-center justify-center mr-2 flex-shrink-0">
        <Cpu className="w-4 h-4 text-cyber-accent" />
      </div>
      <div className="bg-cyber-surface border border-cyber-accent/20 rounded-xl px-4 py-3 flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <div key={i} className="typing-dot w-2 h-2 bg-cyber-accent rounded-full" />
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═════════════════════════════════════════════════════════════
export default function LendingDashboard() {
  const [step,           setStep]          = useState<Step>(1);
  const [btcAddress,     setBtcAddress]    = useState('');
  const [isLoading,      setIsLoading]     = useState(false);
  const [scanLogs,       setScanLogs]      = useState<ScanLog[]>([]);
  const [scanIndex,      setScanIndex]     = useState(0);
  const [creditData,     setCreditData]    = useState<CreditData | null>(null);
  const [chatMessages,   setChatMessages]  = useState<ChatMsg[]>([]);
  const [chatInput,      setChatInput]     = useState('');
  const [isTyping,       setIsTyping]      = useState(false);
  const [sessionId,      setSessionId]     = useState<string | null>(null);
  const [currentOffer,   setCurrentOffer]  = useState<Record<string, unknown> | null>(null);
  const [txHash,         setTxHash]        = useState<string | null>(null);
  const [txProgress,     setTxProgress]    = useState(0);
  const [txStage,        setTxStage]       = useState('');
  const [termsAccepted,  setTermsAccepted] = useState(false);
  const [loanAmount,     setLoanAmount]    = useState(1000);
  const [loanDuration,   setLoanDuration]  = useState(30);
  const [loanToken,      setLoanToken]     = useState<'USDt' | 'XAUt'>('USDt');

  const chatEndRef   = useRef<HTMLDivElement>(null);
  const logEndRef    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [scanLogs]);

  // ── Step 1: Connect & Verify ────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleConnect = useCallback(() => {
    const addr = btcAddress.trim() || DEMO_BTC_ADDRESS;
    setBtcAddress(addr);
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setStep(2);
      startScan(addr);
    }, 2000);
  }, [btcAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: Intercom Scan ───────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startScan = useCallback((addr: string) => {
    setScanLogs([]);
    setScanIndex(0);

    let i = 0;
    const interval = setInterval(() => {
      if (i >= SCAN_LOGS.length) {
        clearInterval(interval);
        // Build credit data after scan
        const data: CreditData = {
          score:      87,
          tier:       'LOW',
          btcBalance: 2.5,
          txCount:    1420,
          aprRange:   [4, 6],
          maxLoan:    5000,
          reasoning:  `Loan approved because your Intercom profile shows:\n• 2.5 BTC balance ($162,500) — substantial on-chain collateral\n• 1,420 transactions over 72 months — proven financial track record since 2019\n• $TRAC holder status — trusted ecosystem participant (premium rate tier)\n• 1 positive repayment signal from peer agent DeFi-Agent-Alpha`,
          tapTokens:  [
            { ticker: 'TRAC', amount: 4250, usdValue: 2125 },
            { ticker: 'NAT',  amount: 1800, usdValue: 180  },
          ],
        };
        setCreditData(data);
        setTimeout(() => setStep(3), 1000);
        return;
      }
      setScanLogs(prev => [...prev, SCAN_LOGS[i]]);
      setScanIndex(i);
      i++;
    }, 280);
  }, []);

  // ── Step 3 → 4: Start Negotiation ──────────────────────────
  const handleStartNegotiation = useCallback(async () => {
    if (!creditData) return;
    setStep(4);
    setIsTyping(true);

    // Call API to start negotiation
    try {
      const res = await fetch('/api/agent/negotiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:        'START',
          creditProfile: {
            btcAddress:   btcAddress || DEMO_BTC_ADDRESS,
            score:        creditData.score,
            tier:         creditData.tier,
            breakdown:    { balanceScore: 35, activityScore: 36, assetScore: 12, reputationBonus: 3, total: 87 },
            maxLoanUSDt:  creditData.maxLoan,
            aprRange:     creditData.aprRange,
            reasoning:    creditData.reasoning,
            calculatedAt: Date.now(),
          },
          amount:        loanAmount,
          token:         loanToken,
          durationDays:  loanDuration,
        }),
      });

      const data = await res.json();

      setIsTyping(false);
      if (data.success && data.data) {
        setSessionId(data.data.sessionId);
        setCurrentOffer(data.data.offer ?? null);
        setChatMessages([{
          role:      'ai',
          content:   data.data.message,
          timestamp: new Date(),
        }]);
      }
    } catch {
      setIsTyping(false);
      // Fallback to demo message
      setSessionId('demo-session-' + Date.now());
      const demoMsg = buildDemoOpeningMessage(creditData, loanAmount, loanToken, loanDuration);
      setChatMessages([{
        role:      'ai',
        content:   demoMsg,
        timestamp: new Date(),
      }]);
      setCurrentOffer({
        amount:         loanAmount,
        token:          loanToken,
        aprPercent:     creditData.aprRange[0] + 1,
        durationDays:   loanDuration,
        totalRepayment: loanAmount * (1 + (creditData.aprRange[0] + 1) / 100 / 365 * loanDuration),
      });
    }
  }, [creditData, btcAddress, loanAmount, loanToken, loanDuration]);

  // ── Step 4: Chat ────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || !sessionId) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg, timestamp: new Date() }]);
    setIsTyping(true);

    const isAccept = /accept|agreed|deal|ok|yes|confirm|take it/i.test(msg);

    try {
      const res = await fetch('/api/agent/negotiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CHAT', sessionId, message: msg }),
      });
      const data = await res.json();

      await new Promise(r => setTimeout(r, 800));
      setIsTyping(false);

      if (data.success && data.data) {
        setChatMessages(prev => [...prev, {
          role:      'ai',
          content:   data.data.message,
          timestamp: new Date(),
        }]);
        if (data.data.offer) setCurrentOffer(data.data.offer);
        if (data.data.status === 'ACCEPTED' || isAccept) {
          setTermsAccepted(true);
        }
      }
    } catch {
      await new Promise(r => setTimeout(r, 1200));
      setIsTyping(false);

      if (isAccept) {
        setTermsAccepted(true);
        setChatMessages(prev => [...prev, {
          role:      'ai',
          content:   `✅ Terms Accepted!\n\nExcellent. Loan terms are locked in. Initiating WDK settlement process...\n\n📋 Final Terms:\n• Amount: ${loanAmount} ${loanToken}\n• APR: ${(creditData?.aprRange[0] ?? 5) + 1}%\n• Duration: ${loanDuration} days\n• Due: ${new Date(Date.now() + loanDuration * 86400000).toLocaleDateString('en-US')}\n\n🔐 Transferring funds via WDK self-custodial layer...`,
          timestamp: new Date(),
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role:      'ai',
          content:   buildDemoCounterMessage(creditData, msg, loanAmount, loanToken, loanDuration),
          timestamp: new Date(),
        }]);
      }
    }
  }, [chatInput, sessionId, creditData, loanAmount, loanToken, loanDuration]);

  const handleAcceptTerms = useCallback(() => {
    setTermsAccepted(true);
    setChatMessages(prev => [...prev, {
      role:      'ai',
      content:   `✅ Terms Accepted!\n\nInitiating WDK settlement...\n\n📋 Final Terms:\n• Amount: ${loanAmount} ${loanToken}\n• APR: ${(creditData?.aprRange[0] ?? 5) + 1}%\n• Duration: ${loanDuration} days\n\n🔐 Transferring via WDK self-custodial layer...`,
      timestamp: new Date(),
    }]);
  }, [loanAmount, loanToken, loanDuration, creditData]);

  // ── Step 5: Collateral Deposit ────────────────────────────
  const handleExecute = useCallback(async () => {
    setStep(5);  // Go to collateral deposit step
    Logger.info('[LoanFlow] Proceeding to collateral deposit');
  }, []);

  // ── Step 6: WDK Settlement (triggered after collateral lock) ──
  const saveLoanToLocalStorage = useCallback((txHashValue: string) => {
    try {
      if (!creditData) return;
      
      const collateralWBTC = loanAmount / 95000;
      const newLoan: LoanRecord = {
        id: `loan_${Date.now()}_${Math.random().toString(36).slice(7)}`,
        btcAddress: btcAddress || DEMO_BTC_ADDRESS,
        amount: loanAmount,
        token: loanToken,
        aprPercent: creditData.aprRange[0] + 1,
        durationDays: loanDuration,
        totalRepayment: loanAmount * (1 + ((creditData.aprRange[0] + 1) / 100 / 365 * loanDuration)),
        disbursedAt: Date.now(),
        dueAt: Date.now() + (loanDuration * 86400000),
        status: 'ACTIVE',
        txHashDisbursement: txHashValue,
        amountRepaid: 0,
        creditScore: creditData.score,
        reasoning: creditData.reasoning,
        agentReasoningLog: ['Demo mode settlement'],
        collateralWBTC,
      };

      const existing = JSON.parse(localStorage.getItem('loanHistory') || '[]') as LoanRecord[];
      localStorage.setItem('loanHistory', JSON.stringify([newLoan, ...existing]));
      Logger.info('Loan saved to localStorage', { loanId: newLoan.id, amount: loanAmount });
    } catch (error) {
      Logger.error('Failed to save loan to localStorage', { error });
    }
  }, [creditData, loanAmount, loanToken, loanDuration, btcAddress]);

  const handleSettlement = useCallback(async () => {
    setStep(6);
    setTxProgress(0);

    const stages = [
      { msg: '🔐 WDK: Initializing self-custodial transfer...', pct: 15 },
      { msg: '🔑 WDK: Signing transaction with agent private key...', pct: 30 },
      { msg: '📡 WDK: Broadcasting to Tether network...', pct: 50 },
      { msg: '⛓️  WDK: Waiting for on-chain confirmation...', pct: 70 },
      { msg: '🔗 Intercom: Broadcasting reputation update...', pct: 85 },
      { msg: '✅ WDK: USD₮ settled on-chain successfully!', pct: 100 },
    ];

    for (const stage of stages) {
      setTxStage(stage.msg);
      setTxProgress(stage.pct);
      await new Promise(r => setTimeout(r, 900));
    }

    // Execute via API
    try {
      const sid = sessionId ?? 'demo-session';
      const res = await fetch('/api/agent/execute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await res.json();
      if (data.success && data.data?.txHash) {
        setTxHash(data.data.txHash);
        saveLoanToLocalStorage(data.data.txHash);
        return;
      }
    } catch {}

    // Demo fallback
    setTxHash(DEMO_TX_HASH);
    saveLoanToLocalStorage(DEMO_TX_HASH);
  }, [sessionId, saveLoanToLocalStorage]);

  // ── Loan Params ─────────────────────────────────────────────
  const loanParams = {
    amount:          loanAmount,
    apr:             (creditData?.aprRange[0] ?? 5) + 1,
    duration:        loanDuration,
    totalRepayment:  loanAmount * (1 + ((creditData?.aprRange[0] ?? 5) + 1) / 100 / 365 * loanDuration),
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cyber-bg bg-cyber-grid scanline">
      {/* ── Header ── */}
      <header className="border-b border-cyber-border bg-cyber-surface/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyber-accent to-cyber-purple flex items-center justify-center shadow-cyber">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-cyber-text text-sm tracking-wide">GALACTICA</h1>
              <p className="text-[10px] font-mono text-cyber-muted">LENDING BOT v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-cyber-green/10 border border-cyber-green/30 rounded-full">
              <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
              <span className="text-cyber-green text-xs font-mono">AGENT LIVE</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-mono text-cyber-muted">
              <Wallet className="w-4 h-4 text-cyber-gold" />
              <span className="text-cyber-gold font-bold">${AGENT_TREASURY.toLocaleString('en-US')}</span>
              <span className="text-cyber-muted">USDt</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-cyber-text/60 px-2 py-1 bg-cyber-surface border border-cyber-border/30 rounded">
              <Globe className="w-3 h-3 text-cyber-purple" />
              <span title={process.env.NEXT_PUBLIC_ETH_ADDRESS_FULL || 'Settlement ETH Address'}>{process.env.NEXT_PUBLIC_ETH_ADDRESS_SHORT || '0x742d...f0bEb'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyber-muted">
              <Activity className="w-4 h-4 text-cyber-accent" />
              <span className="text-cyber-accent font-bold">{ACTIVE_LOANS}</span>
              <span className="hidden sm:inline text-cyber-muted">loans</span>
            </div>
            
            {/* Loan History Button */}
            <button
              onClick={() => window.location.href = `/loans?address=${DEMO_BTC_ADDRESS}`}
              className="ml-auto px-3 py-1.5 bg-cyber-surface border border-cyber-accent/40 hover:border-cyber-accent rounded text-xs font-mono text-cyber-accent hover:bg-cyber-accent/10 transition-all"
              title="View your loan history and collateral status"
            >
              📊 History
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* ── Step Indicator ── */}
        <StepIndicator current={step} total={6} />

        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 1 — IDENTITY CONNECTION                       */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-cyber-text mb-2">
                  Bitcoin <span className="text-cyber-accent">Identity</span> Layer
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  Prove Bitcoin ownership via BIP-137 cryptographic signature
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Connect Panel */}
                <CyberCard className="p-6" glow>
                  <div className="flex items-center gap-2 mb-4">
                    <Bitcoin className="w-5 h-5 text-cyber-gold" />
                    <h3 className="font-bold text-sm">Connect Bitcoin Address</h3>
                  </div>

                  <div className="mb-4">
                    <label className="text-xs text-cyber-muted font-mono mb-2 block">
                      BTC ADDRESS (leave blank to use demo)
                    </label>
                    <input
                      type="text"
                      value={btcAddress}
                      onChange={e => setBtcAddress(e.target.value)}
                      placeholder={DEMO_BTC_ADDRESS}
                      className="w-full bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm font-mono text-cyber-text placeholder:text-cyber-muted/50 focus:outline-none focus:border-cyber-accent/60 transition-all"
                    />
                  </div>

                  <div className="bg-cyber-surface rounded-lg p-3 mb-4 border border-cyber-border">
                    <p className="text-xs font-mono text-cyber-muted mb-2">SIGNING CHALLENGE:</p>
                    <p className="text-xs font-mono text-cyber-green/70 break-all" suppressHydrationWarning>
                      Auth:a3f9b2c1-4e5d-6f7a-8b9c-0d1e2f3a4b5c<br/>
                      Address:{btcAddress || DEMO_BTC_ADDRESS}<br/>
                      Service:GalacticaLendingBot<br/>
                      Time:{new Date().toISOString()}
                    </p>
                  </div>

                  <motion.button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="w-full bg-cyber-accent text-cyber-bg font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-cyber-accent/80 transition-all disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying ownership of {(btcAddress || DEMO_BTC_ADDRESS).slice(0, 10)}...
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Sign & Verify Identity
                      </>
                    )}
                  </motion.button>
                </CyberCard>

                {/* How it works */}
                <CyberCard className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-5 h-5 text-cyber-purple" />
                    <h3 className="font-bold text-sm">How Identity Works</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: Lock,     color: 'text-cyber-accent', title: 'BIP-137 Standard',    desc: 'Industry-standard Bitcoin message signing protocol.' },
                      { icon: Database, color: 'text-cyber-purple', title: 'Intercom Protocol',   desc: 'On-chain history queried from Trac Systems indexers.' },
                      { icon: Shield,   color: 'text-cyber-green',  title: 'Zero-Trust Verify',   desc: 'No credit scoring without cryptographic proof of ownership.' },
                      { icon: Award,    color: 'text-cyber-gold',   title: 'Reputation Graph',    desc: 'Peer agent signals build your decentralized credit score.' },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} className="flex gap-3">
                          <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-cyber-surface border border-cyber-border flex items-center justify-center ${item.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className={`text-xs font-bold ${item.color}`}>{item.title}</p>
                            <p className="text-xs text-cyber-muted">{item.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CyberCard>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Agent Treasury',   value: `$${AGENT_TREASURY.toLocaleString('en-US')}`, sub: 'USDt Available', icon: DollarSign, color: 'text-cyber-green' },
                  { label: 'Active Loans',      value: ACTIVE_LOANS.toString(), sub: 'Outstanding',    icon: TrendingUp,  color: 'text-cyber-accent' },
                  { label: 'Avg APR',           value: '7.2%',  sub: 'Weighted avg',  icon: BarChart3,   color: 'text-cyber-gold' },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <CyberCard key={i} className="p-4 text-center">
                      <Icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
                      <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-cyber-muted">{stat.label}</div>
                      <div className="text-[10px] text-cyber-muted/60 font-mono">{stat.sub}</div>
                    </CyberCard>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 2 — INTERCOM DATA SCAN                        */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.div key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">
                  <span className="text-cyber-purple">Intercom</span> Protocol Scan
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  Querying Trac Systems indexers for on-chain reputation
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4 mb-6">
                {/* Pulse animation */}
                <CyberCard className="md:col-span-1 p-6 flex flex-col items-center justify-center">
                  <div className="relative w-28 h-28 mb-4">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full border-2 border-cyber-purple/40"
                        animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                      />
                    ))}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-cyber-purple/20 border-2 border-cyber-purple flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                        <Database className="w-8 h-8 text-cyber-purple" />
                      </div>
                    </div>
                  </div>
                  <p className="text-cyber-purple font-mono text-sm font-bold">SCANNING</p>
                  <p className="text-cyber-muted text-xs font-mono mt-1">
                    {scanLogs.length}/{SCAN_LOGS.length} queries
                  </p>
                  <div className="w-full bg-cyber-border rounded-full h-1.5 mt-3">
                    <motion.div
                      className="h-1.5 bg-cyber-purple rounded-full"
                      animate={{ width: `${(scanLogs.length / SCAN_LOGS.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </CyberCard>

                {/* Terminal */}
                <CyberCard className="md:col-span-2 overflow-hidden">
                  <div className="bg-cyber-surface border-b border-cyber-border px-4 py-2 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    <span className="text-cyber-muted text-xs font-mono ml-2">trac-intercom-terminal</span>
                  </div>
                  <div className="h-64 overflow-y-auto p-4 font-mono text-xs">
                    {scanLogs.filter(Boolean).map((log, i) => (
                      <motion.div
                        key={i}
                        className={`mb-1 ${
                          log?.type === 'success' ? 'text-cyber-green' :
                          log?.type === 'ai'      ? 'text-cyber-accent' :
                          log?.type === 'data'    ? 'text-cyber-gold' :
                          log?.type === 'error'   ? 'text-cyber-red' :
                          'text-cyber-muted'
                        }`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {log?.text}
                      </motion.div>
                    ))}
                    {scanLogs.length < SCAN_LOGS.length && (
                      <span className="text-cyber-accent animate-pulse">█</span>
                    )}
                    <div ref={logEndRef} />
                  </div>
                </CyberCard>
              </div>

              {/* Data cards */}
              {scanLogs.length > 8 && (
                <motion.div
                  className="grid grid-cols-2 md:grid-cols-4 gap-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[
                    { label: 'BTC Balance',    value: '2.5000 BTC', sub: '$162,500', color: 'text-cyber-gold' },
                    { label: 'Total TXs',      value: '1,420',      sub: '6-month avg: 18/mo', color: 'text-cyber-accent' },
                    { label: '$TRAC Tokens',   value: '4,250',      sub: '≈$2,125 USD', color: 'text-cyber-purple' },
                    { label: 'Account Age',    value: '72 months',  sub: 'Since Jan 2019', color: 'text-cyber-green' },
                  ].map((card, i) => (
                    <CyberCard key={i} className="p-3 text-center">
                      <div className={`text-base font-bold font-mono ${card.color}`}>{card.value}</div>
                      <div className="text-[10px] text-cyber-muted mt-0.5">{card.label}</div>
                      <div className="text-[10px] text-cyber-muted/60 font-mono">{card.sub}</div>
                    </CyberCard>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 3 — CREDIT DASHBOARD                          */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 3 && creditData && (
            <motion.div key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold mb-2">
                  Credit <span className="text-cyber-green">Assessment</span>
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  AI-powered score from Intercom Protocol on-chain analysis
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-6">
                {/* Score Gauge */}
                <CyberCard className="p-6 flex flex-col items-center" glow>
                  <ScoreGauge score={creditData.score} tier={creditData.tier} />
                  <div className="mt-2 flex gap-2">
                    <span className="px-3 py-1 bg-cyber-green/20 text-cyber-green text-xs font-bold rounded-full border border-cyber-green/30">
                      ✓ APPROVED
                    </span>
                    <span className="px-3 py-1 bg-cyber-accent/20 text-cyber-accent text-xs font-bold rounded-full border border-cyber-accent/30">
                      LOW RISK
                    </span>
                  </div>
                </CyberCard>

                {/* Stats */}
                <div className="md:col-span-2 space-y-3">
                  {/* Treasury card */}
                  <CyberCard className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-cyber-gold" />
                        <span className="text-sm font-bold">Agent Treasury</span>
                      </div>
                      <span className="text-xs text-cyber-green font-mono">● FUNDED</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-2xl font-bold font-mono text-cyber-gold">${AGENT_TREASURY.toLocaleString('en-US')}</div>
                        <div className="text-xs text-cyber-muted">USDt Available</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold font-mono text-cyber-green">10.00</div>
                        <div className="text-xs text-cyber-muted">XAUt Available</div>
                      </div>
                    </div>
                  </CyberCard>

                  {/* Score breakdown */}
                  <CyberCard className="p-4">
                    <p className="text-xs font-mono text-cyber-muted mb-3">SCORE BREAKDOWN</p>
                    {[
                      { label: 'Balance Score',   value: 35, max: 40, color: '#00D4FF' },
                      { label: 'Activity Score',  value: 36, max: 40, color: '#7C3AED' },
                      { label: 'Asset Score',     value: 12, max: 20, color: '#F5A623' },
                      { label: 'Reputation Bonus',value: 3,  max: 10, color: '#00FF9F' },
                    ].map((row, i) => (
                      <div key={i} className="mb-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-cyber-muted font-mono">{row.label}</span>
                          <span className="font-bold font-mono" style={{ color: row.color }}>
                            {row.value}/{row.max}
                          </span>
                        </div>
                        <div className="h-1.5 bg-cyber-border rounded-full">
                          <motion.div
                            className="h-1.5 rounded-full"
                            style={{ backgroundColor: row.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(row.value / row.max) * 100}%` }}
                            transition={{ duration: 1, delay: i * 0.2 }}
                          />
                        </div>
                      </div>
                    ))}
                  </CyberCard>
                </div>
              </div>

              {/* AI Reasoning */}
              <CyberCard className="p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-cyber-accent" />
                  <span className="text-sm font-bold">AI Agent Reasoning</span>
                  <span className="ml-auto text-xs font-mono text-cyber-accent">EXPLAINABLE AI</span>
                </div>
                <div className="bg-cyber-surface rounded-lg p-3 font-mono text-xs text-cyber-green/80 leading-relaxed whitespace-pre-line">
                  {creditData.reasoning}
                </div>
              </CyberCard>

              {/* Loan Request Controls */}
              <CyberCard className="p-5 mb-6">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyber-gold" />
                  Configure Loan Request
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-cyber-muted font-mono mb-1 block">
                      AMOUNT ({loanToken}) — Max: {creditData.maxLoan.toLocaleString('en-US')}
                    </label>
                    <input
                      type="range" min={100} max={creditData.maxLoan} step={100}
                      value={loanAmount}
                      onChange={e => setLoanAmount(Number(e.target.value))}
                      className="w-full accent-cyber-accent"
                    />
                    <div className="text-cyber-accent font-bold font-mono text-center mt-1">
                      ${loanAmount.toLocaleString('en-US')}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-cyber-muted font-mono mb-1 block">
                      DURATION (days)
                    </label>
                    <input
                      type="range" min={7} max={90} step={7}
                      value={loanDuration}
                      onChange={e => setLoanDuration(Number(e.target.value))}
                      className="w-full accent-cyber-purple"
                    />
                    <div className="text-cyber-purple font-bold font-mono text-center mt-1">
                      {loanDuration} days
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-cyber-muted font-mono mb-1 block">TOKEN</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {(['USDt', 'XAUt'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setLoanToken(t)}
                          className={`py-2.5 rounded-lg text-sm font-bold border transition-all ${
                            loanToken === t
                              ? 'bg-cyber-accent/20 border-cyber-accent text-cyber-accent'
                              : 'bg-cyber-surface border-cyber-border text-cyber-muted hover:border-cyber-accent/40'
                          }`}
                        >
                          {t === 'USDt' ? '💵 USDt' : '🥇 XAUt'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CyberCard>

              <motion.button
                onClick={handleStartNegotiation}
                className="w-full bg-gradient-to-r from-cyber-accent to-cyber-purple text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-lg hover:opacity-90 transition-all shadow-cyber"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <MessageSquare className="w-5 h-5" />
                Start AI Negotiation
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 4 — AI CHAT NEGOTIATOR                        */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 4 && (
            <motion.div key="step4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-4">
                <h2 className="text-3xl font-bold mb-1">
                  <span className="text-cyber-accent">ARIA</span> — AI Negotiator
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  Autonomous Risk Intelligence Agent — OpenClaw Framework
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {/* Chat Panel */}
                <div className="md:col-span-2">
                  <CyberCard className="overflow-hidden" glow>
                    {/* Chat header */}
                    <div className="bg-cyber-surface border-b border-cyber-border px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-cyber-accent/20 border border-cyber-accent flex items-center justify-center">
                          <Cpu className="w-4 h-4 text-cyber-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-cyber-accent">ARIA</p>
                          <p className="text-[10px] text-cyber-green font-mono">● Risk Manager Online</p>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-cyber-muted">
                        Session: {sessionId?.slice(0, 12) ?? 'pending'}...
                      </div>
                    </div>

                    {/* Messages */}
                    <div className="h-72 overflow-y-auto p-4">
                      {chatMessages.map((msg, i) => (
                        <ChatBubble key={i} msg={msg} />
                      ))}
                      {isTyping && <TypingIndicator />}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="border-t border-cyber-border p-3">
                      {termsAccepted ? (
                        <motion.button
                          onClick={handleExecute}
                          className="w-full bg-cyber-green text-cyber-bg font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Zap className="w-4 h-4" />
                          Execute WDK Settlement
                        </motion.button>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            placeholder='Try: "Accept", "14 days instead", or ask a question...'
                            className="flex-1 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2.5 text-sm font-mono text-cyber-text placeholder:text-cyber-muted/50 focus:outline-none focus:border-cyber-accent/60"
                          />
                          <motion.button
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || isTyping}
                            className="px-4 bg-cyber-accent text-cyber-bg rounded-lg disabled:opacity-40 hover:bg-cyber-accent/80 transition-all"
                            whileTap={{ scale: 0.95 }}
                          >
                            <Send className="w-4 h-4" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </CyberCard>

                  {/* Quick actions */}
                  {!termsAccepted && chatMessages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {[
                        '✅ Accept Terms',
                        '⏳ Reduce to 14 days',
                        '💰 Lower amount to $500',
                        '❓ Explain the rate',
                      ].map((action, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setChatInput(action.replace(/^[^ ]+ /, ''));
                          }}
                          className="text-xs px-3 py-1.5 bg-cyber-surface border border-cyber-border rounded-full text-cyber-muted hover:border-cyber-accent/40 hover:text-cyber-accent transition-all font-mono"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Offer panel */}
                <div className="space-y-3">
                  <CyberCard className="p-4" glow={!!currentOffer}>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-cyber-gold" />
                      <span className="text-xs font-bold">Current Offer</span>
                    </div>
                    {currentOffer ? (
                      <div className="space-y-2">
                        {[
                          { label: 'Amount',    value: `${currentOffer.amount} ${currentOffer.token}`, color: 'text-cyber-gold' },
                          { label: 'APR',       value: `${currentOffer.aprPercent}%`,                  color: 'text-cyber-accent' },
                          { label: 'Duration',  value: `${currentOffer.durationDays} days`,             color: 'text-cyber-purple' },
                          { label: 'Repayment', value: `$${(currentOffer.totalRepayment as number).toFixed(2)}`, color: 'text-cyber-green' },
                        ].map((row, i) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="text-cyber-muted">{row.label}</span>
                            <span className={`font-bold ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                        <div className="border-t border-cyber-border pt-2 mt-2">
                          <button
                            onClick={handleAcceptTerms}
                            className="w-full bg-cyber-green/20 border border-cyber-green/40 text-cyber-green text-xs font-bold py-2 rounded-lg hover:bg-cyber-green/30 transition-all"
                          >
                            ✓ Accept These Terms
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-cyber-muted text-xs font-mono text-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2 text-cyber-accent" />
                        Calculating offer...
                      </div>
                    )}
                  </CyberCard>

                  <CyberCard className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="w-4 h-4 text-cyber-purple" />
                      <span className="text-xs font-bold">Your Profile</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-cyber-muted">Score</span>
                        <span className="text-cyber-green font-bold">{creditData?.score}/100</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-cyber-muted">Tier</span>
                        <span className="text-cyber-green font-bold">{creditData?.tier} RISK</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-cyber-muted">BTC</span>
                        <span className="text-cyber-gold font-bold">{creditData?.btcBalance} BTC</span>
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-cyber-muted">Max Loan</span>
                        <span className="text-cyber-accent font-bold">${creditData?.maxLoan.toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  </CyberCard>

                  <CyberCard className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-cyber-accent" />
                      <span className="text-xs font-bold text-cyber-accent">Negotiation Tips</span>
                    </div>
                    <ul className="space-y-1.5 text-xs text-cyber-muted font-mono">
                      <li>• Cut duration in half for -2% APR</li>
                      <li>• Max discount: 2% off base rate</li>
                      <li>• $TRAC holders: premium tier</li>
                      <li>• Type &quot;Accept&quot; to lock terms</li>
                    </ul>
                  </CyberCard>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 5 — COLLATERAL DEPOSIT                        */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 5 && (
            <motion.div key="step5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  Lock <span className="text-cyber-purple">Collateral</span>
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  Deposit WBTC to escrow smart contract to secure your loan
                </p>
              </div>

              <CyberCard className="p-8" glow>
                {/* Collateral Info */}
                {(() => {
                  const collateralPercent = 1.0;
                  const BTC_PRICE = 95000;
                  const collateralUSD = Math.max(loanAmount * collateralPercent, 95);
                  const collateralWBTC = collateralUSD / BTC_PRICE;
                  const collateralContractAddress = process.env.NEXT_PUBLIC_COLLATERAL_CONTRACT || '0xCollateralEscrow...';

                  return (
                    <div className="space-y-6">
                      {/* Collateral Amount Card */}
                      <div className="bg-cyber-surface rounded-lg p-6 border border-cyber-accent/30">
                        <h3 className="text-sm font-bold text-cyber-accent mb-4">Collateral Required</h3>
                        <div className="text-4xl font-bold text-cyber-text mb-2">
                          {collateralWBTC.toFixed(6)} <span className="text-lg text-cyber-muted">WBTC</span>
                        </div>
                        <p className="text-cyber-muted text-sm">Approximately ${collateralUSD.toFixed(2)} USD</p>
                      </div>

                      {/* How It Works */}
                      <div className="bg-cyber-void/50 rounded-lg p-4 border border-cyber-border/30 space-y-3">
                        <h4 className="text-sm font-bold text-cyber-text">How It Works:</h4>
                        <ol className="text-xs text-cyber-muted space-y-2 list-decimal list-inside">
                          <li>
                            <span className="text-cyber-green font-semibold">Connect Ethereum Wallet</span> — MetaMask or WalletConnect
                          </li>
                          <li>
                            <span className="text-cyber-green font-semibold">Approve WBTC Transfer</span> — Sign approval transaction
                          </li>
                          <li>
                            <span className="text-cyber-green font-semibold">Lock Collateral</span> — Deposit to escrow smart contract
                          </li>
                          <li>
                            <span className="text-cyber-green font-semibold">Proceed to Settlement</span> — Once locked, receive USD₮
                          </li>
                        </ol>
                      </div>

                      {/* Escrow Contract Info */}
                      <div className="bg-cyber-surface/50 rounded-lg p-3 border border-cyber-purple/20 text-xs font-mono">
                        <p className="text-cyber-muted mb-1">🔒 Escrow Contract Address</p>
                        <p className="text-cyber-purple break-all">{collateralContractAddress}</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            // In real implementation, this would:
                            // 1. Connect MetaMask
                            // 2. Show approval flow
                            // 3. Execute lockCollateral() on contract
                            Logger.info('[LoanFlow] Collateral lock initiated');
                            // Proceed to settlement with animation
                            handleSettlement();
                          }}
                          className="flex-1 px-6 py-3 bg-cyber-accent text-black font-bold rounded-lg hover:bg-cyber-accent/90 transition-colors"
                        >
                          🔒 Lock Collateral
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setStep(4)}
                          className="px-6 py-3 bg-cyber-surface border border-cyber-border rounded-lg hover:border-cyber-accent/50 transition-colors text-cyber-muted"
                        >
                          ← Back
                        </motion.button>
                      </div>

                      <p className="text-xs text-cyber-muted text-center pt-2">
                        Collateral remains locked until loan is repaid or defaults
                      </p>
                    </div>
                  );
                })()}
              </CyberCard>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════ */}
          {/* STEP 6 — WDK SETTLEMENT                            */}
          {/* ══════════════════════════════════════════════════ */}
          {step === 6 && (
            <motion.div key="step5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-2">
                  WDK <span className="text-cyber-green">Settlement</span>
                </h2>
                <p className="text-cyber-muted font-mono text-sm">
                  Self-custodial on-chain transfer via Wallet Dev Kit
                </p>
              </div>

              <CyberCard className="p-8" glow>
                {/* Animated hex grid background */}
                <div className="relative mb-8">
                  {txHash ? (
                    <motion.div
                      className="text-center"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <motion.div
                        className="w-20 h-20 rounded-full bg-cyber-green/20 border-2 border-cyber-green mx-auto flex items-center justify-center mb-4"
                        animate={{ boxShadow: ['0 0 20px rgba(0,255,159,0.3)', '0 0 50px rgba(0,255,159,0.6)', '0 0 20px rgba(0,255,159,0.3)'] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <CheckCircle className="w-10 h-10 text-cyber-green" />
                      </motion.div>
                      <h3 className="text-xl font-bold text-cyber-green mb-1">USD₮ Settled On-Chain</h3>
                      <p className="text-cyber-muted text-sm font-mono mb-4">
                        {loanAmount.toLocaleString('en-US')} {loanToken} transferred to your Ethereum address
                      </p>
                      
                      {/* Settlement Details */}
                      <div className="bg-cyber-surface rounded-lg p-3 mb-4 border border-cyber-border/50 text-xs font-mono">
                        <div className="mb-3 pb-3 border-b border-cyber-border/30">
                          <div className="text-cyber-gold font-bold mb-1">🎯 Settlement Address</div>
                          <div className="text-cyber-text/70 break-all">{process.env.NEXT_PUBLIC_ETH_ADDRESS_SHORT || '0x742d35...7595f0bEb'}</div>
                        </div>
                        <div className="text-cyber-green">
                          <div className="font-bold mb-1">🔐 Collateral Requirement</div>
                          {/* Calculate collateral: 1:1 ratio of loan amount in USD, then convert to WBTC */}
                          {(() => {
                            const collateralPercent = 1.0;
                            const BTC_PRICE = 95000;
                            const collateralUSD = Math.max(loanAmount * collateralPercent, 95);
                            const collateralWBTC = collateralUSD / BTC_PRICE;
                            return (
                              <div className="text-cyber-text/70">
                                {collateralWBTC.toFixed(6)} WBTC (≈ ${collateralUSD.toFixed(2)})
                                <br />
                                <span className="text-xs text-cyber-muted">Locked in Smart Contract</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <motion.div
                        className="w-20 h-20 rounded-full bg-cyber-accent/10 border-2 border-cyber-accent mx-auto flex items-center justify-center mb-4"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      >
                        <Zap className="w-10 h-10 text-cyber-accent" />
                      </motion.div>
                      <p className="text-cyber-accent font-mono text-sm">{txStage || 'Initializing...'}</p>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-mono text-cyber-muted mb-2">
                    <span>Settlement Progress</span>
                    <span className="text-cyber-accent">{txProgress}%</span>
                  </div>
                  <div className="h-3 bg-cyber-surface rounded-full overflow-hidden border border-cyber-border">
                    <motion.div
                      className="h-3 rounded-full bg-gradient-to-r from-cyber-accent to-cyber-green"
                      style={{ boxShadow: '0 0 10px rgba(0,212,255,0.5)' }}
                      animate={{ width: `${txProgress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Stage log */}
                <div className="bg-cyber-surface rounded-lg p-4 mb-6 border border-cyber-border font-mono text-xs space-y-1.5">
                  {[
                    { done: txProgress >= 15,  label: '🔐 WDK Initialized — Agent key loaded from secure env' },
                    { done: txProgress >= 30,  label: '🔑 Transaction signed — Self-custodial authorization' },
                    { done: txProgress >= 50,  label: '📡 Broadcast to Tether network — Awaiting mempool' },
                    { done: txProgress >= 70,  label: '⛓️  On-chain confirmation — 6/6 blocks confirmed' },
                    { done: txProgress >= 85,  label: '🌐 Intercom signal broadcast — Reputation updated' },
                    { done: txProgress >= 100, label: '✅ Settlement complete — Funds in borrower wallet' },
                  ].map((s, i) => (
                    <div key={i} className={`flex items-center gap-2 transition-all ${s.done ? 'text-cyber-green' : 'text-cyber-muted/40'}`}>
                      <span>{s.done ? '▶' : '○'}</span>
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* TX Hash */}
                {txHash && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="bg-cyber-green/5 border border-cyber-green/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-cyber-green" />
                        <span className="text-xs font-bold text-cyber-green">TRANSACTION HASH</span>
                      </div>
                      <p className="font-mono text-xs text-cyber-green break-all mb-3">{txHash}</p>
                      <a
                        href={`https://mempool.space/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-cyber-accent hover:text-cyber-accent/80 font-mono"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on mempool.space →
                      </a>
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Amount Sent',  value: `${loanAmount} ${loanToken}`,    color: 'text-cyber-gold' },
                        { label: 'APR',          value: `${loanParams.apr}%`,             color: 'text-cyber-accent' },
                        { label: 'Duration',     value: `${loanDuration} days`,           color: 'text-cyber-purple' },
                        { label: 'Total Due',    value: `$${loanParams.totalRepayment.toFixed(2)}`, color: 'text-cyber-green' },
                      ].map((row, i) => (
                        <div key={i} className="bg-cyber-surface rounded-lg p-3 text-center border border-cyber-border">
                          <div className={`text-sm font-bold font-mono ${row.color}`}>{row.value}</div>
                          <div className="text-[10px] text-cyber-muted font-mono">{row.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Intercom signal */}
                    <div className="bg-cyber-purple/5 border border-cyber-purple/30 rounded-xl p-3 flex items-center gap-3">
                      <Globe className="w-5 h-5 text-cyber-purple flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-cyber-purple">Intercom Protocol Updated</p>
                        <p className="text-xs text-cyber-muted font-mono mt-0.5">
                          Loan signal broadcast to peer agents. Your on-chain reputation is now trackable across the Galactica network.
                        </p>
                      </div>
                    </div>

                    {/* Reset */}
                    <motion.button
                      onClick={() => {
                        setStep(1); setTxHash(null); setTxProgress(0); setTxStage('');
                        setChatMessages([]); setCreditData(null); setScanLogs([]);
                        setSessionId(null); setCurrentOffer(null); setTermsAccepted(false);
                        setBtcAddress('');
                      }}
                      className="w-full border border-cyber-border text-cyber-muted py-3 rounded-xl flex items-center justify-center gap-2 hover:border-cyber-accent/40 hover:text-cyber-accent transition-all text-sm font-mono"
                      whileHover={{ scale: 1.01 }}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Start New Loan Request
                    </motion.button>
                  </motion.div>
                )}
              </CyberCard>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-cyber-border mt-12 py-6 text-center">
        <p className="text-cyber-muted text-xs font-mono">
          GALACTICA LENDING BOT v1.0 — Hackathon 2026 |{' '}
          <span className="text-cyber-accent">Intercom Protocol</span> ×{' '}
          <span className="text-cyber-gold">WDK Settlement</span> ×{' '}
          <span className="text-cyber-green">Bitcoin Identity</span>
        </p>
        <p className="text-cyber-muted/40 text-[10px] font-mono mt-1">
          Built with OpenClaw Framework · Self-custodial · Non-custodial · Decentralized
        </p>
      </footer>
    </div>
  );
}

// ── Demo message helpers ──────────────────────────────────────
function buildDemoOpeningMessage(
  creditData: CreditData,
  amount: number,
  token: string,
  duration: number
): string {
  const apr = creditData.aprRange[0] + 1;
  const total = amount * (1 + apr / 100 / 365 * duration);
  return `👋 Hello! I'm **ARIA**, your Autonomous Risk Intelligence Agent.

I've analyzed your Bitcoin wallet via the **Intercom Protocol** and your on-chain profile is impressive:
📊 Credit Score: **${creditData.score}/100** (${creditData.tier} Risk)

Based on your on-chain history — stable 2.5 BTC holdings since 2019, 1,420 transactions, and $TRAC holder status — here's my opening offer:

📋 **OFFER:**
• Loan: **${amount} ${token}**
• APR: **${apr}%**
• Duration: **${duration} days**
• Total Repayment: **$${total.toFixed(2)}**

💡 *Tip: I can lower the rate by up to 2% if you agree to repay within ${Math.floor(duration / 2)} days.*

Type **"Accept"** to confirm, or counter with your preferred terms.`;
}

function buildDemoCounterMessage(
  creditData: CreditData | null,
  userMsg: string,
  amount: number,
  token: string,
  duration: number
): string {
  const apr = (creditData?.aprRange[0] ?? 5) + 0.5;
  const total = amount * (1 + apr / 100 / 365 * duration);
  return `⚡ Interesting proposal. Let me recalculate...

After reviewing your request against Intercom risk parameters:

📋 **REVISED OFFER:**
• Loan: **${amount} ${token}**
• APR: **${apr}%** ✅ *(adjusted)*
• Duration: **${duration} days**
• Total Repayment: **$${total.toFixed(2)}**

This represents my best offer based on your current Intercom profile. Type **"Accept"** to proceed to WDK settlement.`;
}
