import {
  LayoutDashboard, Users, Target, PhoneCall,
  FileText, Zap, Kanban, ClipboardList, CalendarDays,
  UsersRound, Settings, Bell,
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
      { href: "/potentials", label: "Potentials", icon: Target, keywords: "pipeline crm leads deals" },
      { href: "/follow-ups", label: "Follow-ups", icon: Bell, keywords: "reminders" },
      { href: "/call-list", label: "Call List", icon: PhoneCall, keywords: "calls phone" },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/activities", label: "Activities", icon: Kanban, keywords: "kanban board" },
      { href: "/tasks", label: "Tasks", icon: ClipboardList, keywords: "todo assignments" },
      { href: "/roster", label: "Roster", icon: CalendarDays, keywords: "schedule shifts calendar" },
      { href: "/management", label: "Management", icon: Settings, kyeOnly: true, keywords: "admin settings" },
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
  { href: "/roster", label: "Roster", icon: CalendarDays },
  { href: "/call-list", label: "Calls", icon: PhoneCall },
];

/** Flat list of navigable (non-"soon") items, for search / command palette use. */
export function flatNavItems(isKye: boolean): NavItem[] {
  return navGroups
    .flatMap((g) => g.items)
    .filter((item) => !item.soon && item.href !== "#")
    .filter((item) => !item.kyeOnly || isKye);
}
