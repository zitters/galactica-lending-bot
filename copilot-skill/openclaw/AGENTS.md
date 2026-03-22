# OpenClaw Agents

## Agent Roles for OpenClaw Integration

- `OpenClawNegotiator`: core negotiation behavior, defines APR tiers and collateral logic.
- `IntercomProfiler`: reads from `src/data/IntercomProvider.ts` outputs `IntercomBTCProfile`.
- `WDKSettlement`: does settlement side via `src/wallet/WDKClient.ts`.

## Goal
Enable OpenClaw to drive loan offers but still route settlement through existing WDK client.

## Usage
- In `src/logic/Negotiator.ts`, check `process.env.OPENCLAW_ENABLED`.
- If enabled, call OpenClaw prompt + parse JSON output using `mustache` or direct template.
- Keep current fallback logic (non-OpenClaw) unchanged.
