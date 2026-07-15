/**
 * Minimal email sender using the Resend REST API.
 * Requires RESEND_API_KEY (and optionally RESEND_FROM) in the environment.
 * Without a key, sends fail gracefully so callers can surface a clear message.
 */
export async function sendEmail({
  to, subject, text,
}: {
  to: string; subject: string; text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY is missing)." };
  }
  const from = process.env.RESEND_FROM ?? "KW Hub <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Email provider error (${res.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Email send failed: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}
