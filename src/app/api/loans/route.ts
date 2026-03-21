// src/app/api/loans/route.ts
// GET /api/loans — List all loans

import { NextResponse } from 'next/server';
import { LocalStore }   from '@/db/LocalStore';

export async function GET() {
  try {
    const loans = await LocalStore.getAllLoans();
    const stats = await LocalStore.getStats();

    return NextResponse.json({
      success: true,
      data:    { loans, stats },
      timestamp: Date.now(),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
