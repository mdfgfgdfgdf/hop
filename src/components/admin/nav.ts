import { BarChart3, Car, LayoutDashboard, LifeBuoy, Route, ScrollText, Settings, Tags, Users, type LucideIcon } from "lucide-react";

export type NavKey = "overview" | "drivers" | "users" | "rides" | "tickets" | "pricing" | "reports" | "audit" | "settings";

export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  icon: LucideIcon;
  group: "ops" | "business" | "system";
  /** Support staff can view but not change anything here. */
  adminWrite?: boolean;
  detailLabel?: string;
};

export const NAV: NavItem[] = [
  { key: "overview", href: "/admin", label: "סקירה", icon: LayoutDashboard, group: "ops" },
  { key: "drivers", href: "/admin/drivers", label: "נהגים", icon: Car, group: "ops", detailLabel: "פרטי נהג" },
  { key: "users", href: "/admin/users", label: "משתמשים", icon: Users, group: "ops", detailLabel: "פרטי משתמש" },
  { key: "rides", href: "/admin/rides", label: "נסיעות", icon: Route, group: "ops", detailLabel: "פרטי נסיעה" },
  { key: "tickets", href: "/admin/tickets", label: "פניות", icon: LifeBuoy, group: "ops", detailLabel: "פנייה" },
  { key: "pricing", href: "/admin/pricing", label: "תמחור ושירותים", icon: Tags, group: "business", adminWrite: true },
  { key: "reports", href: "/admin/reports", label: "דוחות", icon: BarChart3, group: "business" },
  { key: "audit", href: "/admin/audit", label: "יומן ביקורת", icon: ScrollText, group: "system" },
  { key: "settings", href: "/admin/settings", label: "הגדרות", icon: Settings, group: "system", adminWrite: true },
];

export const NAV_GROUPS: { key: NavItem["group"]; label: string }[] = [
  { key: "ops", label: "תפעול" },
  { key: "business", label: "עסקי" },
  { key: "system", label: "מערכת" },
];

export function activeNav(pathname: string) {
  const item = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => (n.href === "/admin" ? pathname === "/admin" : pathname === n.href || pathname.startsWith(n.href + "/")));
  const isDetail = !!item && item.href !== "/admin" && pathname.startsWith(item.href + "/");
  return { item: item ?? NAV[0], isDetail };
}
