// src/app/api/auth/challenge/route.ts
// POST /api/auth/challenge — Generate a signing challenge

import { NextRequest, NextResponse } from 'next/server';
import { ChallengeManager }          from '@/auth/ChallengeManager';
import { isValidBitcoinAddress }     from '@/utils/helpers';

export async function POST(req: NextRequest) {
  try {
    const { btcAddress } = await req.json();

    if (!btcAddress || !isValidBitcoinAddress(btcAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Bitcoin address' },
        { status: 400 }
      );
    }

    const challenge = ChallengeManager.generate(btcAddress);

    return NextResponse.json({
      success:     true,
      challengeId: challenge.id,
      message:     challenge.message,
      expiresAt:   challenge.expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
