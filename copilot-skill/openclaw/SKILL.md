# OpenClaw Skill

## Purpose
This skill defines integration patterns for using OpenClaw as the negotiation engine within Galactica Lending Bot.

## Intent
- Use OpenClaw or OpenAI alike AI pipeline for loan terms negotiation.
- Provide plain JSON defaults for lending rules, risk model and fallback path.
- Maintain transparent separation from Intercom + WDK execution logic.

## Apply To
- urls: `**/*.{ts,tsx}`
- context: project uses `src/logic/Negotiator.ts` and OpenAI pipeline.

## Behavior
1. Detect `OPENCLAW_ENABLED=true` in env.
2. If enabled, configure `OPENAI_MODEL` and `OPENCLAW_ENDPOINT`.
3. Use OpenClaw prompt templates (see `prompt.md`).
4. Do not alter existing scoring or settlement code: only modify negotiation persona.

## Files
- `copilot-skill/openclaw/prompt.md` for OpenClaw message templates
- `copilot-skill/openclaw/AGENTS.md` for agent role/intent

## Instructions
- Keep responses concise, focused on loan terms and risk explanation.
- If undefined variables appear (e.g. `AAVE_YIELD`), use fallback safe defaults.
- Do not call the OpenAI API directly in docs; this is a guidance skill for codegen and maintenance.
