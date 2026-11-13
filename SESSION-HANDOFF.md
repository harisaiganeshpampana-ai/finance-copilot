# Session Handoff

Add a new entry at the top of the log for each working day. Keep it short — the goal is that anyone (or Claude) can pick up tomorrow without re-asking.

---

## Template (copy this for each new day)

### YYYY-MM-DD — <who worked on it>

**Goal for today**
- 

**What got done**
- 

**What's in progress (not finished)**
- 

**Blockers / decisions needed**
- 

**Tests**
- [ ] `npm test` passes
- [ ] `npm run build` passes

**Next steps (for the next session)**
1. 

**Notes**
- 

---

## Log

### 2026-11-13 — Day 2: Mock transactions page

**Goal for today**
- Rename the app to "MoneyPulse (Working Title)".
- Show 10 mock transactions and a total Balance, styled with Tailwind.
- Add an automated test for the balance calculation.

**What got done**
- Page title (browser tab) and header now say "MoneyPulse (Working Title)".
- Home page shows a Balance card and a list of 10 mock transactions (date, merchant, amount). Income shows in green with a "+".
- Mock data lives in `src/data/mockTransactions.ts`. No bank connection.
- Balance logic in `src/lib/balance.ts`. Money is stored in whole cents to avoid rounding errors; bad amounts are rejected.
- Tests in `src/__tests__/balance.test.ts` check the math, including negatives, rounding, bad data, and the mock total ($2,082.54).
- Added Indian rupees: the balance and every transaction now also show an INR amount (Indian digit grouping, e.g. ₹1,83,263.52), with tests.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- INR uses a FIXED DEMO RATE of ₹88 = $1 (`USD_TO_INR_DEMO_RATE` in `src/lib/balance.ts`), not a live rate. Before real use: fetch a live rate server-side, or store transactions in INR directly if the product is India-first.
- Confirm the primary currency (USD, INR, or both).

**Tests**
- [x] `npm test` passes
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Decide the next feature (e.g. spending categories, or adding a transaction with server-side validation).

**Notes**
- Still mock data only; real bank APIs come later and must keep API keys server-side.

### 2026-11-13 — Foundation setup

**Goal for today**
- Set up the project foundation. No app features.

**What got done**
- Confirmed Node.js v24.19.0 and npm 11.17.0 are installed.
- Created a Next.js project (TypeScript, Tailwind, App Router, ESLint).
- Added Vitest so every feature can have an automated test (`npm test`).
- Created `CLAUDE.md` with the project rules and this handoff file.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Decide on the first feature to build.
- Git repository initialized (branch `main`). Consider a GitHub repo later for off-computer backup.

**Tests**
- [x] `npm test` passes
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Pick and describe the first feature.

**Notes**
- `npm audit` reports 7 moderate warnings from the starter template's dependencies; not urgent, review before launch.
