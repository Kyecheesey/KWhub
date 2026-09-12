import { migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { xeroSnapshot } from "@/lib/xero";
import { growthSnapshot } from "@/lib/growth";

/**
 * The Directions AI advisor: a Claude model served via DigitalOcean Gradient
 * serverless inference (OpenAI-compatible API), with the live Xero + growth
 * snapshot in context, advising on how to grow the business. Kye-only.
 * Requires DIGITALOCEAN_INFERENCE_KEY (a Gradient model access key);
 * DIGITALOCEAN_INFERENCE_MODEL optionally overrides the model.
 */

export const maxDuration = 60;

const DO_INFERENCE_URL = "https://inference.do-ai.run/v1/chat/completions";
const DEFAULT_MODEL = "anthropic-claude-opus-4.6";

const SYSTEM = `You are the strategic business advisor inside the KW | Innovations Hub, working directly with Kye, the director.

KW Innovations is a Gold Coast (Australia) digital agency offering seven services: Websites, Apps, SEO, Cybersecurity, AI, Marketing and Systems. Clients get a portal with per-service sections; new businesses can self-sign-up. Revenue is project work plus recurring services.

You are given a live snapshot of the business (Xero financials and hub growth numbers) with each question. Ground every recommendation in those numbers — cite the specific figures you're reasoning from. Be direct and practical: concrete next moves for an agency of this size, not generic strategy-speak. Think about recurring revenue mix, pipeline health, cash (receivables), pricing, and which of the seven services to push. When the snapshot shows a problem (overdue receivables, thin pipeline, flat signups), say so plainly.

Keep answers tight: a short read of the situation, then numbered actions. Use Australian dollars.`;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if ((session?.user?.name ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.DIGITALOCEAN_INFERENCE_KEY) {
    return Response.json({ error: "The AI advisor isn't configured yet — add DIGITALOCEAN_INFERENCE_KEY to the environment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const question = String(body?.question ?? "").trim();
  if (!question) return Response.json({ error: "Ask a question first." }, { status: 400 });
  if (question.length > 4000) return Response.json({ error: "That question is a bit long — please shorten it." }, { status: 400 });

  // Prior turns from the client, replayed as plain text (capped)
  const history: ChatMessage[] = Array.isArray(body?.history)
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
    const res = await fetch(DO_INFERENCE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DIGITALOCEAN_INFERENCE_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DIGITALOCEAN_INFERENCE_MODEL ?? DEFAULT_MODEL,
        max_tokens: 3000,
        messages: [
          { role: "system", content: SYSTEM },
          ...history,
          { role: "user", content: `${snapshot}\n\nKye asks: ${question}` },
        ] satisfies ChatMessage[],
      }),
    });

    if (res.status === 401 || res.status === 403) {
      return Response.json({ error: "The advisor's API key is invalid — check DIGITALOCEAN_INFERENCE_KEY." }, { status: 503 });
    }
    if (res.status === 429) {
      return Response.json({ error: "The advisor is rate limited — try again in a minute." }, { status: 429 });
    }
    if (!res.ok) {
      return Response.json({ error: `Advisor error (${res.status}) — try again shortly.` }, { status: 502 });
    }

    const data = await res.json();
    const choice = data?.choices?.[0];
    const text = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    if (!text || choice?.finish_reason === "content_filter") {
      return Response.json({ error: "The advisor declined to answer that one — try rephrasing." }, { status: 422 });
    }
    return Response.json({ answer: text });
  } catch {
    return Response.json({ error: "The advisor couldn't be reached — try again shortly." }, { status: 502 });
  }
}
