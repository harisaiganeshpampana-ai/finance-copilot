import type { FinancialData } from "@/data/mockTransactions";
import { getCurrentUser } from "@/lib/auth/session";
import { getFinancialData } from "@/lib/server/transactions";
import {
  AllProvidersFailedError,
  askWithFallback,
  describeFailures,
  getProviders,
  isRateLimited,
  validateChatRequest,
} from "@/lib/server/copilot";

// Allow time to fall back through up to three AI providers.
export const maxDuration = 60;

// POST /api/chat — the AI Copilot. Runs only on the server; API keys never leave it.
// Requires a logged-in user, so the AI (and its cost) can't be used anonymously.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Please log in to use the Copilot." }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return Response.json({ error: "Too many questions. Please wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = validateChatRequest(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const providers = getProviders();
  if (providers.length === 0) {
    console.error("[api/chat] No AI API key configured (GEMINI_API_KEY, OPENAI_API_KEY or DEEPSEEK_API_KEY).");
    return Response.json({ error: "The Copilot isn't configured yet." }, { status: 503 });
  }

  // Only this user's transactions are loaded (by the id in their signed session) and sent to the AI.
  let financial: FinancialData;
  try {
    financial = await getFinancialData(user.id);
  } catch (err) {
    console.error("[api/chat] Could not load user data:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Couldn't load your financial data. Please try again." }, { status: 503 });
  }

  try {
    const { reply } = await askWithFallback(providers, { ...parsed.data, financial });
    return Response.json({ reply });
  } catch (err) {
    // Details are logged per provider on the server. The browser only gets provider
    // names and status categories, never raw provider responses or keys.
    const failures = err instanceof AllProvidersFailedError ? err.failures : [];
    return Response.json({ error: describeFailures(failures) }, { status: 502 });
  }
}
