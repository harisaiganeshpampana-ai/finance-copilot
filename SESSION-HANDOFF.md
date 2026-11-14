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

### 2026-11-14 — Day 16: Continue with Google

**What got done**
- Production login fixed (config only): `NEXTAUTH_SECRET` added on Vercel, Atlas Network Access opened (0.0.0.0/0), `MONGODB_URI` corrected (user `lragriprep_db_user`, cluster `cluster0.mm7qghn.mongodb.net`, db `calmowe`).
- `GoogleProvider` added to NextAuth (`src/lib/auth/options.ts`), enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set on the server.
- Google users are saved to MongoDB (`handleGoogleSignIn` → `upsertOAuthUser`). Only verified Google emails are accepted; an existing email/password account with the same email is linked and keeps its password. User model: password now optional, new `provider` and `image` fields.
- Google-only accounts can't log in with the password form; signing up with such an email says "Use Continue with Google".
- "Continue with Google" button (official Google logo, dark style) above an "or" divider on /login and /signup; hidden if Google isn't configured. Google sign-in errors return to /login with a friendly message.
- Tests: `google-auth.test.ts`, more in `auth-pages.test.tsx` and `secrets-safety.test.ts`. 238 tests total.

**Blockers / decisions needed**
- Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs must include `https://www.calmowe.com/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local). Authorized JavaScript origins: `https://www.calmowe.com`.
- If the Google consent screen is in "Testing" mode, only listed test users can sign in; publish it for everyone.
- Local `.env.local` still lacks `MONGODB_URI`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, so login and the Google button don't work locally.

**Tests**
- [x] `npm test` passes (238)
- [x] `npm run build` passes

### 2026-11-14 — Day 15: User accounts (NextAuth + MongoDB)

**Goal for today**
- Email/password login with NextAuth, Mongoose and bcryptjs; protect the app.

**What got done**
- Installed `next-auth@4` (stable; supports Next 16), `mongoose`, `bcryptjs`.
- `.env.local` created (git-ignored) with `MONGODB_URI=` (empty, to fill) and a generated `NEXTAUTH_SECRET`.
- `src/lib/server/db.ts`: cached Mongoose connection (no reconnect storm in dev/serverless); clear error if `MONGODB_URI` is missing.
- `src/models/User.ts`: name, email (unique, lowercase), password (bcrypt hash, hidden from queries by default), timestamps.
- NextAuth (`src/lib/auth/options.ts`, `/api/auth/[...nextauth]`): Credentials provider, JWT sessions (30 days), custom /login page.
- Sign-up (`src/app/(auth)/signup/actions.ts` → `src/lib/auth/credentials.ts`): server-side validation (name, email, password 8-72 chars with a letter and a number), duplicate-email check, bcrypt hash (cost 12), never returns the password.
- Log-in: server-side credential check, same timing for unknown emails, best-effort brute-force limit (10 tries / 15 min per email).
- `/login` and `/signup` pages in CalmOwe dark style (show/hide password, live password rules, safe redirect back to the requested page).
- `src/proxy.ts` (Next 16's renamed middleware) protects `/dashboard`, `/copilot` and `/settings`; fails safe to /login if the session can't be read. `/api/chat` now requires login (401), so the AI can't be used anonymously.
- Sidebar shows the logged-in user and a **Log Out** button (also in the phone menu). Greeting uses the account's first name. Avatar links to Settings. Landing "Login"/"Get Started" and the free plan now go to /login and /signup.
- Security fix: turned off Next.js dev logging of server-action arguments (it printed the sign-up password).
- Tests: `auth.test.ts`, `auth-pages.test.tsx`, plus route and secret-safety updates. 216 tests total.

**What's in progress (not finished)**
- Nothing in code. Waiting on configuration (below).

**Blockers / decisions needed**
- Add your MongoDB Atlas connection string to `MONGODB_URI` in `.env.local` (for local) AND in Vercel.
- In Vercel (Settings > Environment Variables, Production): add `MONGODB_URI`, `NEXTAUTH_SECRET` (copy from `.env.local`), and `NEXTAUTH_URL=https://calmowe.com`. Then redeploy. Until then, /dashboard, /copilot and /settings redirect to /login and sign-up shows "not available yet".
- MongoDB Atlas: allow Vercel to connect (Network Access; Vercel uses dynamic IPs, so 0.0.0.0/0 or the Vercel integration).
- Settings page still uses placeholder profile data (name/email aren't loaded from the account yet); dashboard data is still mock data.
- Not built yet: password reset, email verification.

**Tests**
- [x] `npm test` passes (216)
- [x] `npm run build` passes

### 2026-11-14 — Day 14b: Pricing inside Settings

**What got done**
- New "Plan and billing" section in `/settings` (`src/app/(app)/settings/BillingSection.tsx`): current plan (Basic, free; mock `mockUser.plan`), the three plans with prices in the selected currency, "Upgrade to Pro" / "Contact sales" buttons (show "Checkout coming soon"), and a "Compare all plans" link to `/pricing`. Uses the same plan data as the pricing page.
- Fixed an accessibility bug: Settings section heading IDs contained spaces, so screen readers couldn't announce section names. Now slugified.
- Tests added to `settings.test.tsx`. 173 tests total.

### 2026-11-14 — Day 14: Pricing and legal pages

**Goal for today**
- Business infrastructure: pricing page and legal pages.

**What got done**
- `/pricing`: dark pricing page with 3 tiers. Basic (free: basic AI chat, 1 bank account), Pro ($9 or ₹499/mo, "Most popular", glowing border: unlimited AI chat, unlimited bank accounts, debt payoff plans), Enterprise (custom, for teams and families). $/₹ switch linked to the app-wide currency. Subscribe buttons show a "Checkout coming soon" toast (nothing is charged); Basic links to the dashboard.
- `/terms` and `/privacy`: readable legal layout with table of contents and "Last updated: November 2026". Includes not-financial-advice, AI processing (names Gemini, OpenAI, DeepSeek), financial data security, read-only connections, subscriptions, user rights (GDPR, India DPDP Act 2023, California).
- Shared marketing navbar and footer (`src/components/marketing/`). Navbar now has Pricing; footer has Terms of Service and Privacy Policy. Used on landing, pricing and legal pages.
- Tests: `marketing-pages.test.tsx` (nav links, tiers, prices, ₹ switch, glow, checkout toast, legal clauses, table of contents). 170 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- IMPORTANT: the Terms and Privacy Policy are a generated starting point, not legal advice. Have a lawyer review them before real users or payments (especially India DPDP Act and payments/refunds). "Governing law" is deliberately generic until the company's jurisdiction is set.
- Set up the mailboxes legal@calmowe.com and privacy@calmowe.com (referenced in the pages), or change them.
- Some promises must become true before launch: encryption at rest, read-only bank connections, provider no-training settings, cancellation/refund handling.
- Pricing features (unlimited bank accounts, debt payoff plans, Enterprise team features) aren't built yet. Checkout needs a payment provider (e.g. Stripe or Razorpay).

**Tests**
- [x] `npm test` passes (170)
- [x] `npm run build` passes

### 2026-11-14 — Day 13: calmowe.com live, branding finalized

**Goal for today**
- Domain is live; finalize metadata and branding.

**What got done**
- **calmowe.com is live** on Vercel.
- Site metadata moved to `src/lib/site.ts` and used by the root layout:
  - Title: "CalmOwe | AI Financial Copilot" (pages: "Dashboard | CalmOwe", etc.)
  - Description: "Take absolute control of your cash flow with CalmOwe. Your AI-powered personal finance copilot."
  - `metadataBase` = https://calmowe.com, so share previews and canonical links use the real domain; Open Graph and Twitter card set.
- Favicon: kept the Level C mark (`src/app/icon.svg`, plus apple-icon and share image). There is no `logo.png`, and using a generic Lucide icon would split the brand.
- Old names: none in the UI. Internal package renamed to `calmowe`; CLAUDE.md updated. Only the GitHub repo is still called `finance-copilot`.
- Tests: `branding.test.ts` (title, description, domain, layout wiring, no old names anywhere in `src`). 158 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Optional: rename the GitHub repo to `calmowe` (GitHub redirects the old URL; Vercel keeps working).
- Still open from earlier: trademark search for "CalmOwe", social handles.

**Tests**
- [x] `npm test` passes (158)
- [x] `npm run build` passes

### 2026-11-14 — Day 12: Logo ("Level C")

**Goal for today**
- A simple, premium logo, applied everywhere.

**What got done**
- Chose concept 3, "Level C": a bold C with a level bar through it (balanced scale). Geometry lives in one place: `src/components/LogoMark.tsx`.
- Applied to: the logo in the landing nav, footer and app sidebar (`Logo.tsx`, white tile + CalmOwe wordmark), the browser tab icon (`src/app/icon.svg`, thicker stroke for 16px), the iPhone home-screen icon (`src/app/apple-icon.tsx`, 180x180), and the link preview image for shared links (`src/app/opengraph-image.tsx`, 1200x630 with logo and headline).
- Removed the default Next.js favicon.
- Tests: `logo.test.tsx` (mark geometry, accessibility, logo link, favicon matches the mark, icon sizes). 153 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Brand color is black and white for now; an accent color (e.g. for marketing) is still open.
- Before trademark filing, consider a professional designer refining the final mark.

**Tests**
- [x] `npm test` passes (153)
- [x] `npm run build` passes

### 2026-11-14 — Day 11: Structured AI context and strict prompt

**Goal for today**
- Make Copilot answers strictly data-based: structured JSON context, strict system prompt, data sent with each question.

**What got done**
- Context (`buildFinancialContext` in `src/lib/server/copilot.ts`) is now clean JSON with numeric amounts: `summary` (currentBalance, totalIncome, totalExpenses, netCashFlow, openingBalance, period), `upcomingExpenses`, `balanceAfterUpcomingExpenses`, `spendingLast7Days`, `transactions`. All totals are calculated on the server.
- New: upcoming expenses are estimated from recurring bills (rent, utilities, subscriptions repeating monthly, next 30 days): rent $1,450 on Dec 1, power $112.40 on Dec 9, StreamBox $15.49 on Dec 11 = $1,577.89; balance after them $13,344.65 (`estimateUpcomingBills` in `src/lib/insights.ts`).
- System prompt rewritten around: "You are CalmOwe, an expert AI financial copilot... base every answer strictly on the provided transaction data... balance minus the cost, and factor in upcoming expenses... do not make up numbers... say if data is insufficient... no investment advice."
- Each question is sent as "Here is my current financial data: {JSON}. My question is: {question}" (plus exact currency conversions when the question has amounts).
- Loading state now reads "CalmOwe is analyzing your data..."
- Bug found in live test: for "$2,000 laptop" the AI said $10,914.65 left after upcoming bills (correct: $11,344.65). Fix: when a question mentions an amount, the server computes "balance minus cost" and "minus upcoming expenses" exactly, in the display currency, and appends them as "Exact figures computed by CalmOwe" (`affordabilityNotes`). The AI explains; it doesn't do the math.
- Tests: `copilot-context.test.ts` (date math, upcoming bills, context totals, JSON formatting, system prompt wording, prompt format); route tests updated. 141 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Upcoming bills are an estimate from mock data. With real bank data, recurring-bill detection needs to be more robust (amount changes, irregular dates).

**Tests**
- [x] `npm test` passes (147)
- [x] `npm run build` passes

### 2026-11-14 — Day 10: Dedicated /copilot page

**Goal for today**
- Move the AI chat to its own full-height page.

**What got done**
- New route `/copilot` (`src/app/(app)/copilot/page.tsx`, UI in `src/components/copilot/CopilotChat.tsx`).
  - Header "CalmOwe Copilot" with a New chat button, scrollable message area, input pinned to the bottom (fits the screen exactly, no page scroll).
  - Empty state: "Hi Hari, how can I help you with your money today?" plus 3 suggestion chips (₹5,000 purchase, spending this week, pay off debt faster). Clicking a chip sends it.
  - Chat bubbles, animated "Thinking" indicator, error bubbles. Enter sends, Shift+Enter adds a line. Input grows with the text.
- Sidebar "AI Copilot" now goes to `/copilot` and is highlighted there.
- Removed the chat bar from the dashboard (and the old `CopilotBar` component). Chat logic now lives in a reusable hook `useCopilotChat`.
- Backend unchanged apart from the prompt: the AI still gets the mock transaction data from the server, now also all four demo exchange rates (so "₹5,000" converts correctly in any display currency) and an instruction to format amounts with thousands separators.
- Tests: `copilot-page.test.tsx` (nav highlight, empty state, chips, typed messages, history, errors, new chat, no emojis).
- Bug found in live test: the AI read "₹5,000" as $5,000. Fix: the server now finds money amounts in each question (₹/Rs/INR, $, €, £, or words like "rupees") and appends exact conversions (e.g. ₹5,000 = $59.88) before asking the AI (`src/lib/currency-hints.ts`). Prompt also tells it never to treat rupees as dollars. 120 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Conversations aren't saved; they reset when you leave the page.

**Tests**
- [x] `npm test` passes (100)
- [x] `npm run build` passes

### 2026-11-14 — Day 9: AI Copilot connected

**Goal for today**
- Connect the dashboard Copilot chat to a real AI model through a secure backend route.

**What got done**
- New server route `POST /api/chat` (`src/app/api/chat/route.ts`, logic in `src/lib/server/copilot.ts`).
  - Reads `DEEPSEEK_API_KEY` (model `deepseek-chat`), or falls back to `OPENAI_API_KEY` (model `gpt-4o-mini`). Keys are read only on the server.
  - Validates every request on the server: question 1-500 chars, up to 10 history turns (user/assistant only, max 2000 chars each), supported currency.
  - Builds the financial context on the server from our data (balance, month income/expenses, last-7-days spending, all transactions). The browser never sends financial data.
  - System prompt: cash flow and debt only, never investment advice, use only the given data, plain text under 120 words, amounts in the user's selected currency.
  - Errors: 400 invalid input, 429 rate limit (10/min per IP, best-effort per server instance), 503 no key configured, 502 AI failure. Provider error details and keys are never sent to the browser.
- Chat UI in the Copilot bar: user bubbles (right, indigo), Copilot bubbles (left), "Thinking..." spinner, error bubbles, Clear button, follow-up questions keep context. Removed the "isn't connected yet" notice.
- Tests: route with mocked AI responses (`chat-route.test.ts`), chat UI (`copilot-chat.test.tsx`), and a secret-safety check that fails if any non-server file reads API keys (`secrets-safety.test.ts`). 96 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Vercel env var must be named exactly `DEEPSEEK_API_KEY` or `OPENAI_API_KEY`, and enabled for the Production (and Preview, if wanted) environment.
- Local dev has no key, so the chat replies "isn't configured yet". To test locally: `vercel env pull .env.local` (or create `.env.local` with the key; it is git-ignored).
- The rate limit is per server instance. For real traffic, use a shared limiter (e.g. Upstash/Vercel KV) and require login.
- The AI still answers from mock data.
- Live test on Vercel failed with DeepSeek error 402 (Insufficient Balance): the DeepSeek account needs credit at platform.deepseek.com. Key and code are fine.
- UPDATE: three providers with automatic fallback, in order **Gemini (`GEMINI_API_KEY` or `GOOGLE_API_KEY`, model gemini-2.5-flash, thinking off) → OpenAI (`OPENAI_API_KEY`, gpt-4o-mini) → DeepSeek (`DEEPSEEK_API_KEY`, deepseek-chat)**. If one fails (bad key, no credit, quota, outage, timeout) the next is tried. Models can be overridden with `GEMINI_MODEL` / `OPENAI_MODEL` / `DEEPSEEK_MODEL`.
- Chat errors now explain provider failures in plain words (401/403 key rejected, 402 out of credit, 404 model, 429 quota, 5xx outage). Consider making these more generic for end users before public launch.

**Tests**
- [x] `npm test` passes (103)
- [x] `npm run build` passes

### 2026-11-14 — Day 8: Name chosen: CalmOwe

**Goal for today**
- Pick a product name with an available .com and rename the app.

**What got done**
- Checked ~190 candidate names against the Verisign .com registry (RDAP). Chose **CalmOwe**; calmowe.com was unregistered on 2026-11-14.
- Renamed MoneyPulse to CalmOwe everywhere in the app: logo, page titles, landing copy, settings text, Connect Bank modal, footer, tests.
- Browser storage keys renamed (`calmowe.currency`, `calmowe.bankConnected`), so a previously saved currency/bank demo state resets once.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- REGISTER calmowe.com soon (not purchased; availability can change any time).
- Trademark search for "CalmOwe" (USPTO, ipindia.gov.in) before building the brand.
- Check social handles (X, Instagram, LinkedIn).
- Optional: rename the GitHub repo/folder from `finance-copilot` to `calmowe`.

**Tests**
- [x] `npm test` passes
- [x] `npm run build` passes

### 2026-11-13 — Day 7: Connect Bank UI (demo)

**Goal for today**
- UI for connecting a bank account. No real provider (Plaid) yet.

**What got done**
- Sidebar "Demo mode" note replaced with a primary **Connect Bank** button (also in the phone menu).
- Modal "Connect your bank securely" explains safety: bank-grade encryption, read-only access, login stays private, disconnect anytime. Buttons: "Continue to Secure Login" and Cancel. Closes with Escape, the X, or clicking outside; keyboard focus stays inside while open. A small line says no real connection is made yet.
- "Continue to Secure Login" closes the modal and shows the toast "Bank connected successfully (Demo)".
- When connected: sidebar shows "Meridian Bank" (fictional) with a green **Synced** badge and "Checking •••• 4821", plus a Disconnect button. The header pill changes from "Demo data" to a green **Live Data**.
- Connection state is app-wide and remembered in the browser (`src/components/bank/bank-store.tsx`).
- Tests: `bank-connection.test.tsx` (button, modal content, all ways to close, connect, toast, badge, pill, disconnect, no emojis). 68 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- IMPORTANT: after a demo "connection" the pill says "Live Data" but the numbers are still mock data. Before any real user sees this, "Live Data" must only appear when real bank data is actually loaded.
- The modal's safety promises (encryption at rest, read-only, password never seen) must be true of the real integration (e.g. Plaid) before launch.
- Real integration needs: a Plaid (or similar) account, server-side token exchange, secrets kept server-only, and storing access tokens securely.

**Tests**
- [x] `npm test` passes (68)
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Real bank connection via Plaid sandbox, or wire the AI Copilot.

### 2026-11-13 — Day 6: Settings page

**Goal for today**
- Premium `/settings` page with profile, preferences, notifications, danger zone and a save flow.

**What got done**
- `/dashboard` and `/settings` now share one app frame (sidebar + top bar) in `src/app/(app)/layout.tsx`. URLs are unchanged.
- Sidebar highlights the current page (Settings on `/settings`, Overview on `/dashboard`). Transactions and AI Copilot link to sections on the dashboard.
- Settings page (`src/app/(app)/settings/`):
  - Profile: Full Name, Email Address, profile picture placeholder (initials) with Upload. Upload shows a local preview only; it checks type (PNG/JPG/GIF/WebP) and size (max 2 MB). Nothing is uploaded.
  - Preferences: Base Currency (linked to the global currency; the top bar updates too) and a Dark Mode toggle (visual only; turning it off says light theme is coming soon).
  - Notifications: Weekly Summary, Large Transaction Alerts, AI Copilot Tips toggles.
  - Danger Zone: red Delete Account button. In demo mode it only shows a message; nothing is deleted.
  - Sticky Save bar with "unsaved changes" indicator. Save calls a server action that validates on the server (`src/lib/validation/settings.ts`) and shows a success or error toast (`sonner`). Field errors appear inline.
- Custom toggle switch component (`src/components/ui/Switch.tsx`), accessible as role="switch".
- Tests: validation rules, server action, sidebar highlighting, every settings control, save success/error toasts, upload checks. 62 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Settings aren't stored anywhere yet (no database or accounts). The server validates and confirms, then the values reset on reload. Persisting needs accounts + a database.
- Profile picture upload, dark-mode switching and account deletion are placeholders.
- Mock email is `hari@example.com` (`src/data/mockUser.ts`).

**Tests**
- [x] `npm test` passes (62)
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Wire the Copilot to the AI through a server route, or add real accounts so settings can be saved.

**Notes**
- New package: `sonner` (toasts).
- On this Windows machine, PowerShell blocks `npm` scripts (execution policy). In the Terminal use `npm.cmd run dev` / `npm.cmd test` instead of `npm ...`.

### 2026-11-13 — Day 5: Multi-currency

**Goal for today**
- Currency selector (USD, INR, EUR, GBP) that updates every amount on the dashboard instantly.

**What got done**
- Currency dropdown in the dashboard top bar, next to the avatar (`src/components/currency/CurrencySelector.tsx`).
- One app-wide currency setting (`src/components/currency/currency-store.tsx`). Stat cards, chart (line, axis, tooltip), chart total and every transaction update instantly, with no reload. The choice is remembered in the browser.
- Formatting uses `Intl.NumberFormat` per currency: INR uses Indian grouping (₹1,00,000.00); USD $100,000.00; EUR €100,000.00; GBP £100,000.00.
- Fixed demo rates in `src/data/mockTransactions.ts` (`MOCK_EXCHANGE_RATES`): 1 USD = 83.5 INR, 0.92 EUR, 0.79 GBP. A note under the table says they are not live.
- Replaced Day 2's separate "INR underneath" display and its ₹88 rate with this system.
- On phones the greeting shortens to "Hi, Hari" so the selector fits.
- Tests: `currency.test.ts` (conversion, formatting, rounding, bad input) and dashboard tests that switch through all four currencies and check every section. 46 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Rates are hardcoded. Before launch, fetch live rates on the server (keeping any API key server-side).
- Transactions are stored in USD and converted for display. A real multi-currency product would store each transaction in its original currency.
- The landing page preview still shows USD only (no selector there).

**Tests**
- [x] `npm test` passes (46)
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Wire the Copilot to the AI through a server route.

### 2026-11-13 — Day 4: Premium dashboard

**Goal for today**
- Turn `/dashboard` into a real app layout (Stripe/Mercury feel). AI not wired yet.

**What got done**
- App frame (`src/app/dashboard/layout.tsx`): fixed left sidebar (logo, Overview, Transactions, AI Copilot, Settings) and a top bar ("Welcome back, Hari" + account avatar). On phones the sidebar becomes a menu button.
- Three stat cards: Total Balance ($14,922.54, +16.2% vs. start of month), Income this month ($3,850.00), Expenses this month ($1,767.46). Each also shows the rupee amount.
- 7-day spending area chart (recharts, indigo gradient, hover tooltip): $317.46 total.
- Transactions redesigned as a table with category icons (bank, cart, house, car, etc.), category, date, amount, and hover highlight.
- Floating "Can I afford this?" Copilot bar at the bottom. UI only: it sends nothing and says the Copilot isn't connected yet.
- New calculation logic in `src/lib/insights.ts` (balance with opening balance, % change, month totals, daily spending), fully tested. 40 tests total.

**Mock data changes**
- Each transaction now has a category (drives its icon).
- Added a start-of-month balance ($12,840.00) so the balance trend is real math, not a made-up number.
- A few dates moved (rent to the 1st; a few bills into the last 7 days) so the chart has data each day. Count (10) and net total ($2,082.54) unchanged.
- The mock "today" is fixed at Nov 12, 2026 (`MOCK_AS_OF`) so figures stay stable.
- Mock user name "Hari" in `src/data/mockUser.ts`.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- Sidebar: "Transactions" and "AI Copilot" jump to sections on the Overview page; "Settings" shows "Soon". Separate pages come later.
- The avatar button doesn't open anything yet (no accounts).

**Tests**
- [x] `npm test` passes (40)
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Wire the Copilot to the AI through a server route (server-side validation, API key server-only, cash-flow/debt guidance only).

**Notes**
- New package: `recharts` (charts).

### 2026-11-13 — Day 3: Landing page ("Front Door")

**Goal for today**
- Professional landing page at `/`; move the dashboard to `/dashboard`. AI integration paused.

**What got done**
- Dashboard (balance + transactions, USD and INR) moved to `/dashboard`.
- New dark landing page at `/` (`src/app/page.tsx`): nav bar (MoneyPulse, Features, Security, Login, Get Started), hero with headline and "Open the dashboard" button, live product preview using the mock data, 3 feature cards, Security section, call-to-action band, and footer with a "no investment advice" notice.
- Icons from `lucide-react`. No emojis; a test enforces this.
- Mobile-friendly: on phones the nav collapses into a menu button. Checked at 375px wide with no sideways scrolling.
- Site font switched to Geist (was falling back to Arial). Browser tab titles: "MoneyPulse — Cash flow and debt, under control" and "Dashboard · MoneyPulse".
- Tests: `landing.test.tsx` (headline, nav, dashboard link, feature cards, sections, footer, no emojis) and `dashboard.test.tsx`. 22 tests total.

**What's in progress (not finished)**
- Nothing.

**Blockers / decisions needed**
- "Login" and "Get Started" both go to `/dashboard` for now; there is no sign-up/login yet.
- The landing page copy promises things not built yet (read-only bank connections, encryption at rest, AI copilot, avalanche/snowball debt payoff). Each must be true before public launch, or the copy changed.
- Copyright year is fixed at 2026 in the footer (this Next.js version doesn't allow reading the current date while pre-building the page). Update it each year.

**Tests**
- [x] `npm test` passes (22)
- [x] `npm run build` passes

**Next steps (for the next session)**
1. Decide: real login/sign-up next, or resume AI integration.

**Notes**
- New packages: `lucide-react` (icons), `@testing-library/react` + `jsdom` (page render tests).

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
