import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BarChart3,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  KeyRound,
  Package,
  ReceiptText,
  Settings,
  UtensilsCrossed,
  Vault,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { formatIDR } from "../data/menu";
import { cn } from "../lib/cn";
import { kitchenStatusOf, runningOrdersCount, salesToday } from "../lib/orderStatus";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { t } from "../locales/id";
import { useAuth } from "../state/auth";
import { useOrders } from "../state/orders";
import { KasaLogoBlock, StatusDot } from "../ui/KasaLogo";

type NavEntry = { href: string; label: string; icon: LucideIcon; badge?: number };

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, value ? "1" : "0");
  } catch {
    // Storage unavailable (private mode): the preference is simply not remembered.
  }
}

export function Sidebar() {
  const [location] = useLocation();
  const orders = useOrders();
  const { currentStaff, openSwitchModal } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const running = runningOrdersCount(orders);
  const kitchenWaiting = orders.filter((o) => kitchenStatusOf(o) === "queued" || kitchenStatusOf(o) === "preparing").length;

  const toggle = () => {
    setCollapsed((prev) => {
      writeCollapsed(!prev);
      return !prev;
    });
  };

  // Dynamic Navigation entries according to active staff role
  const navEntries: NavEntry[] = useMemo(() => {
    const role = currentStaff.role;

    if (role === "pelayan") {
      return [{ href: "/pelayan", label: t.app.nav.waiterOrders, icon: UtensilsCrossed }];
    }

    if (role === "dapur") {
      return [{ href: "/dapur", label: t.app.nav.kitchen, icon: ChefHat, badge: kitchenWaiting }];
    }

    if (role === "manajer") {
      return [
        { href: "/laporan", label: t.app.nav.reports, icon: BarChart3 },
        { href: "/pesanan", label: t.app.nav.orders, icon: ReceiptText, badge: running },
        { href: "/laci-kas", label: t.app.nav.cashDrawer, icon: Vault },
        { href: "/meja", label: t.app.nav.tables, icon: Armchair },
      ];
    }

    // Default for Admin / Kasir: full access
    return [
      { href: "/", label: t.app.nav.newPos, icon: CirclePlus },
      { href: "/pelayan", label: t.app.nav.waiterShort, icon: UtensilsCrossed },
      { href: "/laci-kas", label: t.app.nav.cashDrawer, icon: Vault },
      { href: "/dapur", label: t.app.nav.kitchen, icon: ChefHat, badge: kitchenWaiting },
      { href: "/pesanan", label: t.app.nav.orders, icon: ReceiptText, badge: running },
      { href: "/meja", label: t.app.nav.tables, icon: Armchair },
      { href: "/produk", label: t.app.nav.products, icon: Package },
      { href: "/laporan", label: t.app.nav.reports, icon: BarChart3 },
    ];
  }, [currentStaff.role, kitchenWaiting, running]);

  const showSettings = currentStaff.role === "admin" || currentStaff.role === "kasir" || currentStaff.role === "manajer";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-ink/10 bg-surface md:flex md:sticky md:top-0 md:h-screen overflow-y-auto scrollbar-none transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("pt-6", collapsed ? "px-3" : "px-5")}>
        {collapsed ? <KasaLogoBlock compact /> : <KasaLogoBlock />}
        {!collapsed && (
          <p className="mt-3 flex items-center gap-2 text-xs text-text-muted">
            <StatusDot />
            {t.app.station}
          </p>
        )}
        {collapsed && (
          <p className="mt-3 flex justify-center" title={t.app.station}>
            <StatusDot />
          </p>
        )}
      </div>

      <nav aria-label={t.app.nav.mainLabel} className={cn("mt-7 space-y-1", collapsed ? "px-2" : "px-3")}>
        {navEntries.map((entry) => (
          <NavItem key={entry.href} entry={entry} active={location === entry.href} collapsed={collapsed} />
        ))}
      </nav>

      {showSettings && (
        <>
          {!collapsed && (
            <div className="mt-6 px-5">
              <p className="label-caps text-xs2 font-medium text-text-light">{t.app.controlSection}</p>
            </div>
          )}
          <nav aria-label={t.app.controlSection} className={cn("mt-2 space-y-1", collapsed ? "px-2" : "px-3")}>
            <NavItem
              entry={{ href: "/pengaturan", label: t.app.nav.settings, icon: Settings }}
              active={location === "/pengaturan"}
              collapsed={collapsed}
            />
          </nav>
        </>
      )}

      <div className="flex-1" />

      {/* Metrics (Shown for Admin/Kasir/Manager) */}
      {!collapsed && (currentStaff.role === "kasir" || currentStaff.role === "admin" || currentStaff.role === "manajer") && (
        <div className="mx-4 mb-4 rounded-xl bg-mineral p-4 border border-border">
          <p className="label-caps text-xs2 font-medium text-text-light">{t.pos.metrics.todaySales}</p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight text-accent">{formatIDR(salesToday(orders))}</p>
        </div>
      )}

      {/* Staff Profile & Quick Switch Trigger */}
      <button
        type="button"
        onClick={openSwitchModal}
        title={t.app.sidebar.switchStaff}
        className={cn(
          "group flex items-center gap-3 border-t border-border text-left transition-colors hover:bg-mineral w-full",
          collapsed ? "justify-center py-4 px-2" : "px-5 py-4",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold shadow-xs transition-transform group-hover:scale-105",
            currentStaff.avatarColor,
          )}
        >
          {currentStaff.initials}
        </span>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm font-bold text-ink truncate">{currentStaff.name}</p>
              <span className="text-2xs font-semibold text-accent bg-accent/15 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                <KeyRound size={10} />
                {t.app.sidebar.pin}
              </span>
            </div>
            <p className="text-xs text-text-muted truncate mt-0.5">{currentStaff.title}</p>
          </div>
        )}
      </button>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? t.app.sidebar.expand : t.app.sidebar.collapse}
        title={collapsed ? t.app.sidebar.expand : t.app.sidebar.collapse}
        className="pressable mb-4 flex h-10 w-10 items-center justify-center self-center rounded-lg text-text-muted hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
    </aside>
  );
}

export function MobileNav() {
  const [location] = useLocation();
  const { currentStaff, openSwitchModal } = useAuth();

  const entries: NavEntry[] = useMemo(() => {
    const role = currentStaff.role;

    if (role === "pelayan") {
      return [{ href: "/pelayan", label: t.app.nav.waiterShort, icon: UtensilsCrossed }];
    }

    if (role === "dapur") {
      return [{ href: "/dapur", label: t.app.nav.kitchenShort, icon: ChefHat }];
    }

    if (role === "manajer") {
      return [
        { href: "/laporan", label: t.app.nav.reports, icon: BarChart3 },
        { href: "/pesanan", label: t.app.nav.orders, icon: ReceiptText },
        { href: "/laci-kas", label: t.app.nav.cashDrawer, icon: Vault },
        { href: "/pengaturan", label: t.app.nav.settings, icon: Settings },
      ];
    }

    return [
      { href: "/", label: t.app.nav.newPos, icon: CirclePlus },
      { href: "/laci-kas", label: t.app.nav.cashDrawer, icon: Vault },
      { href: "/dapur", label: t.app.nav.kitchenShort, icon: ChefHat },
      { href: "/pesanan", label: t.app.nav.orders, icon: ReceiptText },
      { href: "/meja", label: t.app.nav.tables, icon: Armchair },
      { href: "/produk", label: t.app.nav.products, icon: Package },
      { href: "/laporan", label: t.app.nav.reports, icon: BarChart3 },
      { href: "/pengaturan", label: t.app.nav.settings, icon: Settings },
    ];
  }, [currentStaff.role]);

  return (
    <nav
      aria-label={t.app.nav.mainLabel}
      className="fixed inset-x-0 bottom-0 z-40 flex max-w-full items-stretch justify-start gap-1 overflow-x-auto scrollbar-none border-t border-ink/10 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {entries.map((entry) => {
        const Icon = entry.icon;
        const active = location === entry.href;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            aria-label={entry.label}
            title={entry.label}
            className={cn(
              "pressable flex min-h-14 min-w-[64px] flex-none flex-col items-center justify-center gap-1 px-1 py-2 text-xs2",
              active ? "bg-accent/15 text-accent font-bold" : "text-ink-soft",
            )}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
            <span className="max-w-full truncate px-1">{entry.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={openSwitchModal}
        className="pressable flex min-h-14 min-w-[64px] flex-none flex-col items-center justify-center gap-1 px-1 py-2 text-xs2 text-ink-soft hover:text-accent"
        title={t.app.sidebar.switchRole}
      >
        <span className={cn("h-5 w-5 rounded-full flex items-center justify-center font-bold text-2xs", currentStaff.avatarColor)}>
          {currentStaff.initials}
        </span>
        <span className="max-w-full truncate">{t.app.sidebar.switchShort}</span>
      </button>
    </nav>
  );
}

function NavItem({ entry, active, collapsed }: { entry: NavEntry; active: boolean; collapsed: boolean }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-current={active ? "page" : undefined}
      aria-label={entry.label}
      title={entry.label}
      className={cn(
        "pressable relative flex h-11 items-center gap-3 rounded-lg text-sm",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-accent text-white shadow-xs" : "font-medium text-ink-soft hover:bg-ink/5 hover:text-ink",
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.3 : 1.9} />
      {!collapsed && (
        <>
          <span className="flex-1">{entry.label}</span>
          {entry.badge !== undefined && entry.badge > 0 && (
            <span className={cn("rounded-full px-2 py-0.5 text-xs2 font-bold", active ? "bg-ink text-mineral" : "bg-error text-white")}>
              {String(entry.badge).padStart(2, "0")}
            </span>
          )}
        </>
      )}
      {collapsed && entry.badge !== undefined && entry.badge > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-xs2 font-bold leading-none text-white">
          {entry.badge}
        </span>
      )}
    </Link>
  );
}
