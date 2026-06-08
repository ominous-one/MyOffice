# Claude Code — Project Pointer

**READ THIS FIRST:** [`docs/TRUE_NORTH.md`](docs/TRUE_NORTH.md)

That file is the single source of truth for this project. It explains:
- The North Star (Sims-style 2D office with real agentic workforce)
- Current state (what works, what's broken)
- The agentic workforce in `~/.claude/agents/myoffice/`
- How to pick up cold
- The next 3 moves

If `TRUE_NORTH.md` and any other doc disagree, fix the other doc.

## Quick context
- **Operator:** Riley
- **Stack:** React 19 + Phaser 4 (client), Express + Drizzle + Postgres (server), BullMQ daemon spawning `claude` CLI in WSL
- **Prod:** https://claude-cowork-s82t.onrender.com
- **Default agent for project work:** `MyOffice Orchestrator` (delegates to the rest of the workforce)
- **Default model:** `claude-sonnet-4-6`

## Hard rules
- Never commit secrets. Never echo passwords or API keys.
- Soft-delete only. Never `DELETE`.
- Every slice gets an evidence file in `docs/evidence/`.
- Update `docs/TRUE_NORTH.md` at the end of any working session.
