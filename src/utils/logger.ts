// ═══════════════════════════════════════════════════════════════
// src/utils/logger.ts — Structured Agent Logger
// Galactica Lending Bot | Hackathon 2026
// ═══════════════════════════════════════════════════════════════

import { AgentLogEntry } from '@/types';

const COLORS = {
  INFO:     '\x1b[36m',   // Cyan
  WARN:     '\x1b[33m',   // Yellow
  ERROR:    '\x1b[31m',   // Red
  SUCCESS:  '\x1b[32m',   // Green
  DECISION: '\x1b[35m',   // Magenta
  RESET:    '\x1b[0m',
  DIM:      '\x1b[2m',
  BOLD:     '\x1b[1m',
};

export const agentLog: AgentLogEntry[] = [];

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString().replace('T', ' ').substring(0, 23);
}

export function log(
  level: AgentLogEntry['level'],
  message: string,
  data?: Record<string, unknown>
): AgentLogEntry {
  const entry: AgentLogEntry = {
    level,
    message,
    data,
    timestamp: Date.now(),
  };

  agentLog.push(entry);
  if (agentLog.length > 500) agentLog.shift(); // keep circular buffer

  const color = COLORS[level] ?? COLORS.RESET;
  const ts    = formatTimestamp(entry.timestamp);
  const badge = `[${level.padEnd(8)}]`;
  const line  = `${COLORS.DIM}${ts}${COLORS.RESET} ${color}${COLORS.BOLD}${badge}${COLORS.RESET} ${message}`;

  console.log(line);
  if (data) {
    console.log(`${COLORS.DIM}         ↳`, JSON.stringify(data), COLORS.RESET);
  }

  return entry;
}

export const Logger = {
  info:     (msg: string, data?: Record<string, unknown>) => log('INFO', msg, data),
  warn:     (msg: string, data?: Record<string, unknown>) => log('WARN', msg, data),
  error:    (msg: string, data?: Record<string, unknown>) => log('ERROR', msg, data),
  success:  (msg: string, data?: Record<string, unknown>) => log('SUCCESS', msg, data),
  decision: (msg: string, data?: Record<string, unknown>) => log('DECISION', msg, data),
  getLogs:  (): AgentLogEntry[] => [...agentLog],
  clear:    () => { agentLog.length = 0; },
};

export default Logger;
