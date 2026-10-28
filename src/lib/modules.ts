/**
 * Client-portal service modules — the sidebar sections of the client
 * dashboard, one per KW | Innovations service (mirroring the seven
 * disciplines on the marketing site) plus portal utilities. Staff lock and
 * unlock them per client to match the client's plan (clients.portal_modules,
 * a JSON array of keys; NULL = DEFAULT_MODULES). Locked sections stay
 * visible in the portal but greyed out until unlocked.
 */

export interface PortalModule {
  key: string;
  label: string;
  description: string;
  /** always shown, can't be toggled off */
  always?: boolean;
}

export const PORTAL_MODULES: PortalModule[] = [
  { key: "overview",      label: "Overview",      description: "Dashboard home — updates, messages and onboarding", always: true },
  { key: "welcome",       label: "Welcome",       description: "Orientation — how we work together, step by step", always: true },
  { key: "websites",      label: "Websites",      description: "Website projects, builds and updates" },
  { key: "apps",          label: "Apps",          description: "App projects and active development" },
  { key: "seo",           label: "SEO",           description: "Search visibility and optimisation work" },
  { key: "cybersecurity", label: "Cybersecurity", description: "Security monitoring and protection" },
  { key: "ai",            label: "AI",            description: "AI and automation solutions" },
  { key: "marketing",     label: "Marketing",     description: "Content calendar, post approvals and social channels" },
  { key: "systems",       label: "Systems",       description: "Business systems — your ops, one login" },
  { key: "support",       label: "IT Support",    description: "Raise support requests and track their status" },
  { key: "files",         label: "Files",         description: "Shared files and deliverables" },
  { key: "invoices",      label: "Billing",       description: "Plan, invoices and payments" },
  { key: "policies",      label: "Policies",      description: "The policies & procedures we follow", always: true },
];

/** Sections every client gets regardless of plan. */
const ALWAYS_KEYS = PORTAL_MODULES.filter((m) => m.always).map((m) => m.key);

/** Add any always-on sections missing from a list of enabled keys. */
export function withAlwaysModules(keys: string[]): string[] {
  const out = [...keys];
  for (const k of ALWAYS_KEYS) if (!out.includes(k)) out.push(k);
  return out;
}

/** What a client sees before staff customise anything (mirrors the old portal). */
export const DEFAULT_MODULES = ["overview", "websites", "apps", "files", "invoices"];

/** Keys stored before the service split, mapped onto today's sections. */
const LEGACY_KEYS: Record<string, string[]> = {
  projects: ["websites", "apps"],
};

export function parseModules(raw: string | null | undefined): string[] {
  if (!raw) return withAlwaysModules(DEFAULT_MODULES);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return withAlwaysModules(DEFAULT_MODULES);
    const valid = new Set(PORTAL_MODULES.map((m) => m.key));
    const keys: string[] = [];
    for (const k of parsed) {
      if (typeof k !== "string") continue;
      for (const mapped of LEGACY_KEYS[k] ?? [k]) {
        if (valid.has(mapped) && !keys.includes(mapped)) keys.push(mapped);
      }
    }
    if (!keys.includes("overview")) keys.unshift("overview");
    return withAlwaysModules(keys);
  } catch {
    return withAlwaysModules(DEFAULT_MODULES);
  }
}
