/**
 * Sign IT Digital integration — KW's own e-signature product.
 * Uses Sign IT's public v1 API with a team API key:
 *   SIGNIT_API_KEY  — sk_signit_… (Sign IT → Settings → API keys)
 *   SIGNIT_APP_URL  — the Sign IT deployment (default https://signitdigital.com)
 * Without a key the Contracts section still works as a manual tracker.
 */

function appUrl(): string {
  return (process.env.SIGNIT_APP_URL ?? "https://signitdigital.com").replace(/\/$/, "");
}

export function signitConfigured(): boolean {
  return !!process.env.SIGNIT_API_KEY;
}

/** Deep link to an envelope in the Sign IT dashboard (place fields, send, track). */
export function signitEnvelopeUrl(envelopeId: string): string {
  return `${appUrl()}/documents/${envelopeId}`;
}

async function call(path: string, init?: RequestInit): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  const key = process.env.SIGNIT_API_KEY;
  if (!key) return { ok: false, error: "Sign IT isn't connected yet (SIGNIT_API_KEY missing)." };
  try {
    const res = await fetch(`${appUrl()}/api/v1${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: (data.error as string) ?? `Sign IT error (${res.status})` };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: `Couldn't reach Sign IT: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

export interface SignitEnvelope {
  id: string;
  status: string;
  sent_at?: string | null;
  completed_at?: string | null;
  recipients?: { name: string; email: string; status: string; signed_at: string | null }[];
}

/**
 * Create an envelope from a PDF. Created as a draft — fields are placed in
 * Sign IT's editor, so the caller gets a deep link to finish and send there.
 */
export async function createEnvelope(opts: {
  title: string;
  pdfBase64: string;
  message?: string;
  recipients: { name: string; email: string }[];
}): Promise<{ ok: true; envelope: { id: string; status: string } } | { ok: false; error: string }> {
  const r = await call("/envelopes", {
    method: "POST",
    body: JSON.stringify({
      title: opts.title,
      pdf_base64: opts.pdfBase64,
      message: opts.message,
      recipients: opts.recipients,
      send: false, // fields get placed in the Sign IT editor before sending
    }),
  });
  if (!r.ok) return r;
  const envelope = r.data.envelope as { id: string; status: string } | undefined;
  if (!envelope?.id) return { ok: false, error: "Sign IT returned an unexpected response." };
  return { ok: true, envelope };
}

/** Fetch an envelope's live status (for syncing contract rows). */
export async function getEnvelope(id: string): Promise<
  { ok: true; envelope: SignitEnvelope } | { ok: false; error: string }
> {
  const r = await call(`/envelopes/${id}`);
  if (!r.ok) return r;
  const envelope = r.data.envelope as SignitEnvelope | undefined;
  if (!envelope?.id) return { ok: false, error: "Sign IT returned an unexpected response." };
  return { ok: true, envelope };
}
