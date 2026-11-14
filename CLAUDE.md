# CalmOwe (Finance Copilot) — Project Rules

Product name: **CalmOwe** (domain to register: calmowe.com). The repo/folder is still named `finance-copilot`.

These rules are non-negotiable. Follow them in every change.

1. **All user input must be validated server-side.** Client-side checks are for convenience only; never trust data that arrives from the browser.
2. **Never provide investment advice; only cash-flow and debt prioritization.** The product must not recommend buying, selling, or holding any stock, fund, crypto, or other security.
3. **Never store API keys in frontend code.** Secrets live in server-only environment variables (e.g. `.env.local`, never prefixed `NEXT_PUBLIC_`) and are used only in server code.
4. **Every feature must have an automated test.** Run tests with `npm test`. A feature is not done until its test passes.

## Working notes

- Stack: Next.js (App Router, TypeScript, Tailwind), tests with Vitest.
- Read `AGENTS.md` before writing Next.js code; this Next.js version may differ from what you expect.
- Update `SESSION-HANDOFF.md` at the end of every working session.
