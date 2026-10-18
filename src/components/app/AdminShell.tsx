"use client";
/**
 * Operator dashboard chrome: collapsible sidebar (desktop), glass top bar
 * with page title, live-feed indicator, role badge and logout; drawer
 * navigation on tablet/phone. Provides the admin context + realtime feed.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ChevronLeft, Headset, Lock, LogOut, Menu, PanelRightClose, PanelRightOpen, ShieldCheck, X } from "lucide-react";
import { AnimatedLogo, AnimatedMark } from "@/components/brand/AnimatedLogo";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/components/app/session";
import { api } from "@/lib/api";
import { AdminProvider, type StaffRole } from "@/components/admin/context";
import { AdminRealtimeProvider, useAdminFeed, useFeedStatus } from "@/components/admin/realtime";
import { useDebouncedCallback, useLoad } from "@/components/admin/hooks";
import { useBrandBusy, useReportBusy } from "@/components/admin/brand";
import { NAV, NAV_GROUPS, activeNav, type NavKey } from "@/components/admin/nav";
import "@/components/admin/admin.css";

const COLLAPSE_KEY = "hop.admin.sidebarCollapsed";
const collapseListeners = new Set<() => void>();
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  collapseListeners.forEach((l) => l());
}
function subscribeCollapsed(l: () => void) {
  collapseListeners.add(l);
  return () => {
    collapseListeners.delete(l);
  };
}

export function AdminShell({ children, demoMode, role, name }: { children: React.ReactNode; demoMode: boolean; role: "admin" | "support"; name: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <AdminProvider role={role} name={name} demoMode={demoMode}>
        <AdminRealtimeProvider>
          <ShellFrame demoMode={demoMode} role={role} name={name}>
            {children}
          </ShellFrame>
        </AdminRealtimeProvider>
      </AdminProvider>
    </MotionConfig>
  );
}

type Counts = Partial<Record<NavKey, { n: number; tone: "warning" | "brand" | "danger" }>>;

function useNavCounts(): Counts {
  const { data, reload, refreshing } = useLoad("nav-counts", () => api.admin.overview());
  useReportBusy("nav-counts", refreshing);
  const debounced = useDebouncedCallback(reload, 2500);
  useAdminFeed((e) => {
    if (e.type === "admin.ride" || e.type === "admin.driver" || e.type === "notification" || e.type === "reconnect") debounced();
  });
  if (!data) return {};
  return {
    drivers: data.pendingVerifications ? { n: data.pendingVerifications, tone: "warning" } : undefined,
    rides: data.activeRides ? { n: data.activeRides, tone: "brand" } : undefined,
    tickets: data.openTickets ? { n: data.openTickets, tone: "danger" } : undefined,
  };
}

function ShellFrame({ children, demoMode, role, name }: { children: React.ReactNode; demoMode: boolean; role: StaffRole; name: string }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const counts = useNavCounts();
  const { item, isDetail } = activeNav(pathname);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const busy = useBrandBusy();
  const logoMode = busy ? "loading" : "idle";

  return (
    <div data-theme="light" data-app="admin" data-role={role} data-user={name} className="admin-root flex min-h-dvh flex-col bg-bg text-fg">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-white [inset-inline-start:8px]">
        דילוג לתוכן
      </a>

      {/* desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 z-30 hidden flex-col border-e border-line bg-[linear-gradient(180deg,#fff_0%,#fff_60%,var(--brand-50)_100%)] transition-[width] duration-300 lg:flex [inset-inline-start:0]",
          collapsed ? "w-[76px]" : "w-[264px]",
        )}
        aria-label="ניווט ראשי"
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-line", collapsed ? "justify-center px-2" : "px-5")}>
          <Link href="/admin" aria-label="HOP — סקירה" className="flex items-center gap-2.5 rounded-xl" data-logo-mode={logoMode}>
            {collapsed ? <AnimatedMark size={38} mode={logoMode} hopOn="hover" title="HOP" /> : <AnimatedLogo height={26} mode={logoMode} hopOn="hover" title="HOP" />}
          </Link>
          {!collapsed && <OpsBadge />}
        </div>
        <NavList collapsed={collapsed} counts={counts} activeKey={item.key} role={role} />
        <div className={cn("border-t border-line p-3", collapsed && "px-2")}>
          <button
            type="button"
            onClick={() => writeCollapsed(!collapsed)}
            className={cn("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-fg-muted transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] hover:text-fg", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"}
            title={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"}
          >
            {collapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            {!collapsed && <span>כיווץ תפריט</span>}
          </button>
        </div>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-300", collapsed ? "lg:ps-[76px]" : "lg:ps-[264px]")}>
        <TopBar
          title={item.label}
          sectionHref={item.href}
          detail={isDetail ? item.detailLabel ?? null : null}
          demoMode={demoMode}
          role={role}
          name={name}
          onMenu={() => setDrawerOpen(true)}
          logoMode={logoMode}
        />
        <main id="admin-main" className="min-w-0 flex-1" tabIndex={-1}>
          {children}
        </main>
      </div>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} counts={counts} activeKey={item.key} role={role} name={name} logoMode={logoMode} />
    </div>
  );
}

function NavList({ collapsed, counts, activeKey, role, onNavigate }: { collapsed?: boolean; counts: Counts; activeKey: NavKey; role: StaffRole; onNavigate?: () => void }) {
  return (
    <nav className={cn("flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
      {NAV_GROUPS.map((g) => (
        <div key={g.key} className="mb-4 last:mb-0">
          {collapsed ? <div className="mx-3 mb-2 h-px bg-line first:hidden" aria-hidden /> : <div className="mb-1.5 px-3 text-[11px] font-bold tracking-[0.08em] text-fg-muted">{g.label}</div>}
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g.key).map((n) => {
              const active = n.key === activeKey;
              const count = counts[n.key];
              const readOnly = n.adminWrite && role !== "admin";
              const Icon = n.icon;
              return (
                <li key={n.key}>
                  <Link
                    href={n.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? n.label : undefined}
                    className={cn(
                      "group relative flex h-11 items-center gap-3 rounded-xl text-[15px] font-semibold transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active ? "bg-brand-50 text-brand-700" : "text-fg/80 hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)] hover:text-fg",
                    )}
                  >
                    {active && <span aria-hidden className="absolute inset-y-2 w-[3px] rounded-full bg-brand [inset-inline-start:-12px]" />}
                    <Icon size={19} className={cn("shrink-0", active ? "text-brand" : "text-fg-muted group-hover:text-fg")} aria-hidden />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{n.label}</span>}
                    {!collapsed && readOnly && <Lock size={13} className="text-fg-muted" aria-label="צפייה בלבד" />}
                    {count && (
                      <span
                        className={cn(
                          "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums text-white",
                          count.tone === "warning" ? "bg-[color-mix(in_oklab,var(--warning)_85%,var(--fg))]" : count.tone === "danger" ? "bg-danger" : "bg-brand",
                          collapsed && "absolute top-1 [inset-inline-end:6px] h-4 min-w-4 px-1 text-[10px]",
                        )}
                        aria-label={`${count.n} ממתינים`}
                      >
                        {count.n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function LiveIndicator() {
  const { connected } = useFeedStatus();
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-bold",
        connected ? "bg-[color-mix(in_oklab,var(--success)_13%,transparent)] text-[color-mix(in_oklab,var(--success)_78%,var(--fg))]" : "bg-[color-mix(in_oklab,var(--warning)_20%,transparent)] text-[color-mix(in_oklab,var(--warning)_55%,var(--fg))]",
      )}
      title={connected ? "מחובר לעדכונים בזמן אמת" : "החיבור לעדכונים נותק — מתחבר מחדש"}
    >
      <span className="relative grid h-2 w-2 place-items-center" aria-hidden>
        {connected && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />}
        <span className={cn("relative h-2 w-2 rounded-full", connected ? "bg-success" : "bg-warning")} />
      </span>
      <span className="hidden sm:inline">{connected ? "זמן אמת" : "מתחבר…"}</span>
      <span className="sr-only sm:hidden">{connected ? "מחובר בזמן אמת" : "מתחבר מחדש"}</span>
    </span>
  );
}

export function RoleBadge({ role, className, compact }: { role: StaffRole; className?: string; compact?: boolean }) {
  const label = role === "admin" ? "מנהל" : "תמיכה";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full text-xs font-bold",
        compact ? "w-7 justify-center" : "px-2.5",
        role === "admin" ? "bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_22%,transparent)]" : "bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] text-fg shadow-[inset_0_0_0_1px_var(--line)]",
        className,
      )}
      aria-label={compact ? `תפקיד: ${label}` : undefined}
      title={compact ? label : undefined}
    >
      {role === "admin" ? <ShieldCheck size={13} aria-hidden /> : <Headset size={13} aria-hidden />}
      {!compact && label}
    </span>
  );
}

function TopBar({
  title,
  sectionHref,
  detail,
  demoMode,
  role,
  name,
  onMenu,
  logoMode,
}: {
  title: string;
  sectionHref: string;
  detail: string | null;
  demoMode: boolean;
  role: StaffRole;
  name: string;
  onMenu: () => void;
  logoMode: "idle" | "loading";
}) {
  const { logout } = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  return (
    <header className="glass glass-strong sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 rounded-none border-x-0 border-t-0 px-3 sm:px-5 lg:px-8">
      <button type="button" onClick={onMenu} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] lg:hidden" aria-label="פתיחת תפריט">
        <Menu size={22} />
      </button>
      <Link href="/admin" aria-label="HOP — סקירה" className="hidden shrink-0 rounded-[10px] sm:block lg:hidden">
        <AnimatedMark size={34} mode={logoMode} hopOn="hover" title="HOP" />
      </Link>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {detail ? (
          <nav aria-label="פירורי לחם" className="flex min-w-0 items-center gap-1.5 text-[15px]">
            <Link href={sectionHref} className="truncate font-semibold text-fg-muted hover:text-fg">
              {title}
            </Link>
            <ChevronLeft size={16} className="shrink-0 text-fg-muted" aria-hidden />
            <span className="truncate font-bold">{detail}</span>
          </nav>
        ) : (
          <div className="truncate text-[17px] font-extrabold tracking-tight">{title}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Visibility wrappers: the components carry their own `inline-flex`, which would beat `hidden`. */}
        {demoMode && (
          <span className="inline-flex sm:hidden">
            <DemoBanner compact text="הדגמה" />
          </span>
        )}
        {demoMode && (
          <span className="hidden sm:inline-flex">
            <DemoBanner compact text="סביבת הדגמה" />
          </span>
        )}
        <LiveIndicator />
        <span className="inline-flex sm:hidden">
          <RoleBadge role={role} compact />
        </span>
        <span className="hidden sm:inline-flex">
          <RoleBadge role={role} />
        </span>
        <div className="hidden items-center gap-2 border-s border-line ps-3 md:flex">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35)]">
            {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
          </span>
          <span className="max-w-[140px] truncate text-sm font-semibold">{name}</span>
        </div>
        <button
          type="button"
          onClick={async () => {
            setLoggingOut(true);
            try {
              await logout();
            } catch {
              setLoggingOut(false);
            }
          }}
          disabled={loggingOut}
          className="hidden h-10 w-10 place-items-center rounded-full text-fg-muted transition-colors hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)] hover:text-fg disabled:opacity-50 sm:grid"
          aria-label="התנתקות"
          title="התנתקות"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function OpsBadge() {
  return <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-extrabold tracking-[0.14em] text-brand-700 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_20%,transparent)]">OPS</span>;
}

function MobileDrawer({ open, onClose, counts, activeKey, role, name, logoMode }: { open: boolean; onClose: () => void; counts: Counts; activeKey: NavKey; role: StaffRole; name: string; logoMode: "idle" | "loading" }) {
  const { logout } = useSession();
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט ניווט" onKeyDown={(e) => e.key === "Escape" && onClose()}>
          <motion.div className="absolute inset-0 bg-[rgba(17,19,24,0.32)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="absolute inset-y-0 flex w-[min(320px,86vw)] flex-col bg-surface shadow-[0_0_60px_-10px_rgba(17,19,24,.45)] [inset-inline-start:0]"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <div className="flex items-center gap-2.5">
                <AnimatedLogo height={24} mode={logoMode} hopOn="both" title="HOP" />
                <OpsBadge />
              </div>
              <button type="button" onClick={onClose} autoFocus className="grid h-11 w-11 place-items-center rounded-full hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="סגירת התפריט">
                <X size={20} />
              </button>
            </div>
            <NavList counts={counts} activeKey={activeKey} role={role} onNavigate={onClose} />
            <div className="flex items-center gap-3 border-t border-line p-4 safe-bottom">
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{name}</div>
                <RoleBadge role={role} className="mt-1 h-6" />
              </div>
              <button type="button" onClick={() => logout()} className="btn btn-ghost btn-sm h-11" aria-label="התנתקות">
                <LogOut size={18} aria-hidden />
                יציאה
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
