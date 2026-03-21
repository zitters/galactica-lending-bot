// src/app/api/auth/verify/route.ts
// POST /api/auth/verify — Verify BIP-137 signature and run Intercom scoring

import { NextRequest, NextResponse } from 'next/server';
import { AgentLoop }                 from '@/core/AgentLoop';

export async function POST(req: NextRequest) {
  try {
    const { btcAddress, signature, challengeId } = await req.json();

    if (!btcAddress || !signature || !challengeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: btcAddress, signature, challengeId' },
        { status: 400 }
      );
    }

    const result = await AgentLoop.verifyAndScore(btcAddress, signature, challengeId);

    return NextResponse.json(result, { status: result.success ? 200 : 401 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
