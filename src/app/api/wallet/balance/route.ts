// src/app/api/wallet/balance/route.ts
// GET /api/wallet/balance — Fetch agent treasury balance

import { NextResponse }  from 'next/server';
import { WDKClient }     from '@/wallet/WDKClient';
import { LocalStore }    from '@/db/LocalStore';
import { YieldOptimizer } from '@/lifecycle/YieldOptimizer';

export async function GET() {
  try {
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
