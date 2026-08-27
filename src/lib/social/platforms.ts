/**
 * Social platform registry — one place that knows which platforms exist,
 * how they're branded in the UI, and whether KWhub can OAuth-connect and
 * auto-publish to them (vs. a manually-tracked account).
 *
 * Auto-publish support: Facebook Pages + Instagram Business (Meta Graph API)
 * and LinkedIn. Everything else can be added as a manual account so it still
 * appears on the calendar and in client approvals; the scheduler emails the
 * team when a manual post falls due.
 */

export type Platform =
  | "facebook" | "instagram" | "linkedin" | "x"
  | "tiktok" | "youtube" | "google_business" | "other";

export interface PlatformInfo {
  key: Platform;
  label: string;
  color: string;
  /** true when KWhub has an OAuth connect flow + publish adapter for it */
  auto: boolean;
}

export const PLATFORMS: PlatformInfo[] = [
  { key: "facebook",        label: "Facebook",         color: "#1877f2", auto: true },
  { key: "instagram",       label: "Instagram",        color: "#e1306c", auto: true },
  { key: "linkedin",        label: "LinkedIn",         color: "#0a66c2", auto: true },
  { key: "x",               label: "X (Twitter)",      color: "#111827", auto: false },
  { key: "tiktok",          label: "TikTok",           color: "#0f172a", auto: false },
  { key: "youtube",         label: "YouTube",          color: "#ff0000", auto: false },
  { key: "google_business", label: "Google Business",  color: "#059669", auto: false },
  { key: "other",           label: "Other",            color: "#64748b", auto: false },
];

export function platformInfo(key: string): PlatformInfo {
  return PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[PLATFORMS.length - 1];
}

/** Which OAuth providers are actually configured in this deployment. */
export function oauthConfigured(): { meta: boolean; linkedin: boolean } {
  return {
    meta: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
    linkedin: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  };
}

export function appBaseUrl(request: Request): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  // Behind Vercel's proxy the request URL is http; trust the forwarded proto
  const proto = url.hostname === "localhost" ? url.protocol.replace(":", "") : "https";
  return `${proto}://${url.host}`;
}
