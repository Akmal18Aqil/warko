import { Bell, ChevronDown, Lock, LogOut, Radio, Repeat, Smartphone, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { isRemoteDataSource } from "../data/index";
import { NetworkHubModal } from "../features/network/NetworkHubModal";
import { cn } from "../lib/cn";
import { t } from "../locales/id";
import { getNetworkHostInfo } from "../services/networkHost";
import { useAuth } from "../state/auth";
import { isDemoMode } from "../state/demo";
import { useRemoteSession } from "../state/remoteSession";
import { IconButton } from "../ui/Button";
import { StatusDot } from "../ui/KasaLogo";
import { DemoModeBadge } from "./DemoModeBadge";

const ACCOUNT_MENU_ITEM =
  "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-mineral focus-visible:outline-2 focus-visible:outline-accent";

export function Header({ title, showSavedStatus = false }: { title: string; showSavedStatus?: boolean }) {
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const [, setLocation] = useLocation();
  const hostInfo = getNetworkHostInfo();
  const { currentStaff, openSwitchModal } = useAuth();
  const remote = useRemoteSession();

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountMenuOpen]);

  const handleNotifications = () => {
    toast(t.app.header.noNotifications);
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 md:px-8 shrink-0 bg-surface text-ink">
        <div>
          <p className="label-caps text-2xs font-medium text-text-muted">{t.app.header.today(new Date())}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <h1 className="font-display text-xl font-bold tracking-tight text-ink md:text-2xl">{title}</h1>
            {showSavedStatus && (
              <span className="flex items-center gap-1.5 text-xs text-text-muted">
                <StatusDot />
                {t.app.header.allSaved}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isDemoMode ? (
            <DemoModeBadge onClick={() => setNetworkModalOpen(true)} />
          ) : (
            /* Local Server & Waiter Pairing Trigger */
            <button
              type="button"
              onClick={() => setNetworkModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-border bg-mineral px-3 py-2 text-xs font-bold text-ink shadow-2xs transition-all hover:border-border-hover"
              title={t.app.header.networkTitle}
            >
              <span className="flex h-2 w-2 rounded-full bg-success-dark animate-pulse" />
              <span className="flex items-center gap-1.5 text-ink-soft">
                <Radio size={14} className="text-success-dark" />
                <span className="hidden sm:inline">{t.app.header.localServer}</span>
                <span className="font-mono text-xs2 font-extrabold text-ink">
                  {hostInfo.host}:{hostInfo.port}
                </span>
              </span>
              <span className="hidden md:inline-flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded ml-0.5 text-2xs font-extrabold text-white">
                <Smartphone size={11} />
                {t.app.header.pairPhone}
              </span>
            </button>
          )}

          <IconButton label={t.app.header.notifications} onClick={handleNotifications}>
            <Bell size={19} />
          </IconButton>

          <div className="relative" ref={accountMenuRef}>
            <button
              ref={accountButtonRef}
              type="button"
              onClick={() => (isRemoteDataSource ? setAccountMenuOpen((open) => !open) : openSwitchModal())}
              aria-expanded={isRemoteDataSource ? accountMenuOpen : undefined}
              aria-controls={isRemoteDataSource ? "account-menu" : undefined}
              aria-label={t.app.header.accountMenu(currentStaff.name)}
              className="group flex items-center gap-2 rounded-full border border-border bg-mineral pl-1 pr-3 py-1 shadow-2xs hover:border-border-hover transition-all"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold shadow-2xs transition-transform group-hover:scale-105",
                  currentStaff.avatarColor,
                )}
              >
                {currentStaff.initials}
              </span>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold leading-none text-ink">{currentStaff.name.split(" ")[0]}</p>
                <p className="text-2xs font-semibold uppercase text-text-muted leading-tight mt-0.5">{currentStaff.role}</p>
              </div>
              <ChevronDown size={14} className="text-text-light transition-colors group-hover:text-ink ml-0.5" />
            </button>
            {isRemoteDataSource && accountMenuOpen && (
              <div
                id="account-menu"
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-surface p-1.5 text-ink shadow-lg"
              >
                {currentStaff.role === "admin" && (
                  <button
                    type="button"
                    className={ACCOUNT_MENU_ITEM}
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setLocation("/pengaturan");
                    }}
                  >
                    <Users size={16} aria-hidden="true" /> {t.app.header.manageStaff}
                  </button>
                )}
                {remote?.device.registered && (
                  <button
                    type="button"
                    className={ACCOUNT_MENU_ITEM}
                    onClick={() => {
                      setAccountMenuOpen(false);
                      openSwitchModal();
                    }}
                  >
                    <Repeat size={16} aria-hidden="true" /> {t.app.header.switchUser}
                  </button>
                )}
                <button
                  type="button"
                  className={ACCOUNT_MENU_ITEM}
                  onClick={() => {
                    setAccountMenuOpen(false);
                    void remote?.signOut();
                  }}
                >
                  {remote?.device.registered ? <Lock size={16} aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}{" "}
                  {remote?.device.registered ? t.app.header.lock : t.app.header.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Network & Pairing Hub Modal */}
      <NetworkHubModal open={networkModalOpen} onClose={() => setNetworkModalOpen(false)} />
    </>
  );
}
