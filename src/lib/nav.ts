import {
  LayoutDashboard, Users, Target, PhoneCall,
  FileText, Zap, Kanban, ClipboardList, Briefcase, Megaphone,
  UsersRound, Settings, Bell, TrendingUp, UserRound, Compass, Handshake, FileSignature,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: React.FC<{ size?: number; strokeWidth?: number }>;
  soon?: boolean;
  kyeOnly?: boolean;
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard, keywords: "home overview" },
      { href: "/clients", label: "Clients", icon: Users, keywords: "customers accounts" },
      { href: "/client-jobs", label: "Client Jobs", icon: Briefcase, keywords: "kanban board jobs work per client support" },
      { href: "/content", label: "Content", icon: Megaphone, keywords: "social media posts calendar planner scheduler marketing approvals" },
      { href: "/potentials", label: "Potentials", icon: Target, keywords: "pipeline crm leads deals" },
      { href: "/follow-ups", label: "Follow-ups", icon: Bell, keywords: "reminders" },
      { href: "/call-list", label: "Cold Calls", icon: PhoneCall, keywords: "calls phone cold calling tracker receptionist" },
      { href: "/insights", label: "Insights", icon: TrendingUp, keywords: "analytics stats charts pipeline reports" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/my-work", label: "My Work", icon: UserRound, keywords: "assigned to me today" },
      { href: "/activities", label: "My Tasks", icon: Kanban, keywords: "kanban board activities personal" },
      { href: "/tasks", label: "Team Tasks", icon: ClipboardList, keywords: "todo assignments tasks" },
      { href: "/contracts", label: "Contracts", icon: FileSignature, keywords: "sign it signit esign signature envelope agreements proposals" },
      { href: "/partnerships", label: "Partnerships", icon: Handshake, kyeOnly: true, keywords: "partners gc media white label agencies" },
      { href: "/management", label: "Management", icon: Settings, kyeOnly: true, keywords: "admin settings" },
      { href: "/directions", label: "Directions", icon: Compass, kyeOnly: true, keywords: "strategy xero financials growth ai advisor business model" },
    ],
  },
  {
    label: "Coming Soon",
    items: [
      { href: "#", label: "Team Hub", icon: UsersRound, soon: true },
      { href: "#", label: "Policies", icon: FileText, soon: true },
      { href: "#", label: "AI Tools", icon: Zap, soon: true },
    ],
  },
];

export const bottomTabs: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/potentials", label: "Potentials", icon: Target },
  { href: "/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/call-list", label: "Calls", icon: PhoneCall },
];

/**
 * Sections Kye can grant or withhold per user from Management → Users &
 * access (users.allowed_sections). The dashboard ("/") is always available;
 * kyeOnly items are governed by the Kye gate instead.
 */
export const ACCESS_SECTIONS: { href: string; label: string }[] = navGroups
  .flatMap((g) => g.items)
  .filter((i) => !i.soon && i.href !== "#" && i.href !== "/" && !i.kyeOnly)
  .map(({ href, label }) => ({ href, label }));

/** Does this user's allowed-sections list (null = everything) cover an item? */
export function sectionAllowed(href: string, sections: string[] | null | undefined): boolean {
  if (!sections) return true;
  if (href === "/" ) return true;
  if (!ACCESS_SECTIONS.some((s) => s.href === href)) return true; // not a gated section
  return sections.includes(href);
}

/** Flat list of navigable (non-"soon") items, for search / command palette use. */
export function flatNavItems(isKye: boolean, sections?: string[] | null): NavItem[] {
  return navGroups
    .flatMap((g) => g.items)
    .filter((item) => !item.soon && item.href !== "#")
    .filter((item) => !item.kyeOnly || isKye)
    .filter((item) => isKye || sectionAllowed(item.href, sections));
}
