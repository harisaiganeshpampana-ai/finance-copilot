import {
  askCopilot,
  describeUpstreamFailure,
  getProvider,
  isRateLimited,
  UpstreamError,
  validateChatRequest,
} from "@/lib/server/copilot";

// POST /api/chat — the AI Copilot. Runs only on the server; the API key never leaves it.
export async function POST(request: Request) {
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

  const provider = getProvider();
  if (!provider) {
    console.error("[api/chat] No AI API key configured (DEEPSEEK_API_KEY or OPENAI_API_KEY).");
    return Response.json({ error: "The Copilot isn't configured yet." }, { status: 503 });
  }

  try {
    const reply = await askCopilot(provider, parsed.data);
    return Response.json({ reply });
  } catch (err) {
    // Log details on the server only. The browser gets a safe reason based on the
    // provider's status code, never the raw provider response or the key.
    console.error("[api/chat] AI request failed:", err instanceof Error ? err.message : err);
    const status = err instanceof UpstreamError ? err.status : undefined;
    return Response.json({ error: describeUpstreamFailure(provider.name, status) }, { status: 502 });
  }
}
