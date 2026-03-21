// src/app/api/agent/execute/route.ts
// POST /api/agent/execute — Execute loan disbursement via WDK

import { NextRequest, NextResponse } from 'next/server';
import { AgentLoop }                 from '@/core/AgentLoop';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing: sessionId' },
        { status: 400 }
      );
    }

    const result = await AgentLoop.executeLoan(sessionId);
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
