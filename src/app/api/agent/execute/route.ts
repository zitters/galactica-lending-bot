// src/app/api/agent/execute/route.ts
// POST /api/agent/execute — Execute loan disbursement via WDK

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing: sessionId' },
        { status: 400 }
      );
    }

    // Skip during build time
    if (process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME) {
      return NextResponse.json(
        { success: false, error: 'Agent execution not available during build' },
        { status: 503 }
      );
    }

    // Dynamic import AgentLoop only at runtime
    const { AgentLoop } = await import('@/core/AgentLoop');

    const result = await AgentLoop.executeLoan(sessionId);
    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
