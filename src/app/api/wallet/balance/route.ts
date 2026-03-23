// src/app/api/wallet/balance/route.ts
// GET /api/wallet/balance — Fetch agent treasury balance

import { NextResponse }  from 'next/server';
import { LocalStore }    from '@/db/LocalStore';
import { YieldOptimizer } from '@/lifecycle/YieldOptimizer';

export async function GET() {
  try {
    // Skip WDK during build time
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME) {
      return NextResponse.json({
        success: true,
        data: {
          balance: { usdt: 100000, xaut: 25, btc: 5.5 },
          stats: { totalLoans: 0, activeLoans: 0, repaidLoans: 0 },
          yieldPositions: [],
          totalYieldEarned: 0,
        },
        timestamp: Date.now(),
      });
    }

    // Dynamic import WDKClient only at runtime
    const { WDKClient } = await import('@/wallet');

    const [balance, stats] = await Promise.all([
      WDKClient.getBalance(),
      LocalStore.getStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        balance,
        stats,
        yieldPositions: YieldOptimizer.getPositions(),
        totalYieldEarned: YieldOptimizer.calculateTotalEarned(),
      },
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
