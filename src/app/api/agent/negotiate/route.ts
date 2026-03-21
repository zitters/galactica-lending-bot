// src/app/api/agent/negotiate/route.ts
// POST /api/agent/negotiate — Start or continue a negotiation session

import { NextRequest, NextResponse } from 'next/server';
import { AgentLoop }                 from '@/core/AgentLoop';
import { CreditProfile, LoanToken }  from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'START') {
      const { creditProfile, amount, token, durationDays } = body as {
        action:        string;
        creditProfile: CreditProfile;
        amount:        number;
        token:         LoanToken;
        durationDays:  number;
      };

      if (!creditProfile || !amount || !token || !durationDays) {
        return NextResponse.json(
          { success: false, error: 'Missing: creditProfile, amount, token, durationDays' },
          { status: 400 }
        );
      }

      const result = await AgentLoop.startNegotiation(
        creditProfile, amount, token, durationDays
      );
      return NextResponse.json(result);
    }

    if (action === 'CHAT') {
      const { sessionId, message } = body as {
        action:    string;
        sessionId: string;
        message:   string;
      };

      if (!sessionId || !message) {
        return NextResponse.json(
          { success: false, error: 'Missing: sessionId, message' },
          { status: 400 }
        );
      }

      const result = await AgentLoop.continueNegotiation(sessionId, message);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: 'Unknown action. Use START or CHAT.' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
