/**
 * Client-portal service modules — the sidebar sections of the client
 * dashboard, one per KW | Innovations service. Staff toggle them per client
 * to match the client's subscription (clients.portal_modules, a JSON array
 * of keys; NULL = DEFAULT_MODULES).
 */

export interface PortalModule {
  key: string;
  label: string;
  description: string;
  /** always shown, can't be toggled off */
  always?: boolean;
}

export const PORTAL_MODULES: PortalModule[] = [
  { key: "overview",  label: "Overview",       description: "Dashboard home — updates, messages and onboarding", always: true },
  { key: "marketing", label: "Marketing",      description: "Content calendar, post approvals and social channels" },
  { key: "projects",  label: "Projects & App", description: "Website / app project tracker and active work" },
  { key: "support",   label: "IT Support",     description: "Raise support requests and track their status" },
  { key: "files",     label: "Files",          description: "Shared files and deliverables" },
  { key: "invoices",  label: "Invoices",       description: "Billing and payments" },
];

/** What a client sees before staff customise anything (mirrors the old portal). */
export const DEFAULT_MODULES = ["overview", "projects", "files", "invoices"];

export function parseModules(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_MODULES;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MODULES;
    const valid = new Set(PORTAL_MODULES.map((m) => m.key));
    const keys = parsed.filter((k): k is string => typeof k === "string" && valid.has(k));
    if (!keys.includes("overview")) keys.unshift("overview");
    return keys;
  } catch {
    return DEFAULT_MODULES;
  }
}
