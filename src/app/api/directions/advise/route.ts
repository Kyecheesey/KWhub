import Anthropic from "@anthropic-ai/sdk";
import { migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { xeroSnapshot } from "@/lib/xero";
import { growthSnapshot } from "@/lib/growth";

/**
 * The Directions AI advisor: Claude with the live Xero + growth snapshot in
 * context, advising on how to grow the business. Kye-only. Requires
 * ANTHROPIC_API_KEY.
 */

export const maxDuration = 60;

const SYSTEM = `You are the strategic business advisor inside the KW | Innovations Hub, working directly with Kye, the director.

KW Innovations is a Gold Coast (Australia) digital agency offering seven services: Websites, Apps, SEO, Cybersecurity, AI, Marketing and Systems. Clients get a portal with per-service sections; new businesses can self-sign-up. Revenue is project work plus recurring services.

You are given a live snapshot of the business (Xero financials and hub growth numbers) with each question. Ground every recommendation in those numbers — cite the specific figures you're reasoning from. Be direct and practical: concrete next moves for an agency of this size, not generic strategy-speak. Think about recurring revenue mix, pipeline health, cash (receivables), pricing, and which of the seven services to push. When the snapshot shows a problem (overdue receivables, thin pipeline, flat signups), say so plainly.

Keep answers tight: a short read of the situation, then numbered actions. Use Australian dollars.`;

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if ((session?.user?.name ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "The AI advisor isn't configured yet — add ANTHROPIC_API_KEY to the environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });
  if (question.length > 4000) return Response.json({ error: "That question is a bit long — please shorten it." }, { status: 400 });

  // Prior turns from the client, replayed as plain text (capped)
  const history: Anthropic.MessageParam[] = Array.isArray(body?.history)
    ? (body.history as { role: string; text: string }[])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string")
        .slice(-10)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.text.slice(0, 6000) }))
    : [];

  const [xero, growth] = await Promise.all([xeroSnapshot(), growthSnapshot()]);
  const snapshot =
    `Live business snapshot (${new Date().toLocaleDateString("en-AU")}):\n` +
    `Xero: ${JSON.stringify(xero)}\n` +
    `Hub growth: ${JSON.stringify(growth)}\n` +
    `(Amounts from the hub are in cents; Xero amounts are in dollars. If Xero shows configured:false, say the financial picture is limited until Xero is connected.)`;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 3000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [...history, { role: "user", content: `${snapshot}\n\nKye asks: ${question}` }],
    });
    if (response.stop_reason === "refusal") {
      return Response.json({ error: "The advisor declined to answer that one — try rephrasing." }, { status: 422 });
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return Response.json({ answer: text });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "The advisor is rate limited — try again in a minute." }, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "The advisor's API key is invalid — check ANTHROPIC_API_KEY." }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: `Advisor error (${err.status}) — try again shortly.` }, { status: 502 });
    }
    return Response.json({ error: "The advisor couldn't be reached — try again shortly." }, { status: 502 });
  }
}
