import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  KeyRound,
  LayoutGrid,
  Clock,
  Maximize2,
  Minimize2,
  ChefHat,
  UtensilsCrossed,
} from "lucide-react";
import { KasaMark } from "../ui/KasaLogo";
import { useAuth } from "../state/auth";
import { getNetworkHostInfo } from "../services/networkHost";
import { cn } from "../lib/cn";
import { STORE_PROFILE } from "../lib/storeProfile";
import { t } from "../locales/id";
import { NetworkHubModal } from "../features/network/NetworkHubModal";
import { isDemoMode } from "../state/demo";
import { DemoModeBadge } from "./DemoModeBadge";

interface FocusModeHeaderProps {
  title: string;
  subtitle?: string;
  roleType: "pelayan" | "dapur";
  badgeCount?: number;
}

export function FocusModeHeader({
  title,
  subtitle,
  roleType,
  badgeCount = 0,
}: FocusModeHeaderProps) {
  const { currentStaff, openSwitchModal } = useAuth();
  const hostInfo = getNetworkHostInfo();
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const fullscreenLabel = isFullscreen ? t.app.focus.fullscreenExit : t.app.focus.fullscreenEnter;
  const isFullAdmin = currentStaff.role === "admin" || currentStaff.role === "kasir";

  return (
    <>
      <header className="sticky top-0 z-30 flex min-w-0 items-center justify-between gap-2 overflow-hidden border-b border-ink/10 bg-surface px-3 py-2.5 text-ink md:px-6 shrink-0 shadow-md">
        {/* Left: Branding & Station Name */}
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-2.5">
            <KasaMark size={32} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-ink">
                  {title || STORE_PROFILE.brand}
                </span>
                <span
                  className={cn(
                    "text-2xs font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1",
                    roleType === "pelayan"
                      ? "border border-success/40 bg-success/20 text-success-dark"
                      : "border border-warning/40 bg-warning/20 text-warning-dark",
                  )}
                >
                  {roleType === "pelayan" ? <UtensilsCrossed size={11} /> : <ChefHat size={11} />}
                  {roleType === "pelayan" ? t.app.focus.waiter : t.app.focus.kitchen}
                  {badgeCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-error-dark text-white font-bold text-2xs">
                      {badgeCount}
                    </span>
                  )}
                </span>
              </div>
              <p className="hidden text-xs2 text-text-muted sm:block">
                {subtitle || t.app.focus.defaultSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Live Realtime Clock */}
        <div className="hidden lg:flex items-center gap-2 border border-border bg-mineral px-3 py-1 rounded-full text-xs text-ink-soft">
          <Clock size={13} className="text-accent" />
          <span className="font-mono font-bold">
            {currentTime.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
          <span className="text-text-light">·</span>
          <span className="text-xs2 text-text-muted">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>

        {/* Right: Actions, Network Status, & Staff Profile */}
        <div className="flex items-center gap-2">
          {isDemoMode ? (
            <DemoModeBadge onClick={() => setNetworkModalOpen(true)} className="px-2.5 py-1.5" />
          ) : (
            /* Local Server WiFi indicator */
            <button
              type="button"
              onClick={() => setNetworkModalOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-mineral px-2.5 py-1.5 text-xs text-ink-soft transition-all hover:border-border-hover sm:flex"
              title={t.app.focus.networkTitle}
            >
              <span className="h-2 w-2 rounded-full bg-success-dark animate-pulse" />
              <span className="font-mono text-xs2">{hostInfo.host}:{hostInfo.port}</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-mineral text-ink-soft transition-all hover:border-border-hover hover:text-ink"
            title={fullscreenLabel}
            aria-label={fullscreenLabel}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {/* Jump to POS Cashier (If Admin/Cashier is testing focus mode) */}
          {isFullAdmin && (
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-mineral px-2.5 py-1.5 text-xs font-bold text-ink transition-all hover:bg-accent hover:text-white"
              title={t.app.focus.toPosTitle}
            >
              <LayoutGrid size={14} />
              <span className="hidden md:inline">{t.app.focus.toPos}</span>
            </Link>
          )}

          {/* Active Staff Badge & PIN Switch Trigger */}
          <button
            type="button"
            onClick={openSwitchModal}
            className="group flex min-w-0 shrink-0 items-center gap-2 rounded-xl border border-border bg-mineral px-2.5 py-1.5 text-xs font-bold text-ink transition-all hover:border-border-hover"
            title={t.app.focus.switchStaffTitle}
          >
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full font-display text-2xs font-bold shadow-2xs",
                currentStaff.avatarColor,
              )}
            >
              {currentStaff.initials}
            </span>
            <span className="hidden max-w-[90px] truncate sm:block md:max-w-[120px]">
              {currentStaff.name.split(" ")[0]}
            </span>
            <span className="hidden items-center gap-0.5 text-2xs font-semibold text-accent-dark bg-accent/15 px-1.5 py-0.5 rounded sm:flex">
              <KeyRound size={10} />
              {t.app.focus.pin}
            </span>
          </button>
        </div>
      </header>

      <NetworkHubModal
        open={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
      />
    </>
  );
}
