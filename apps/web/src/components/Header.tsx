import { useEffect, useRef, useState } from "react";
import { Bell, Radio, Smartphone, ChevronDown, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { IconButton } from "./ui/Button";
import { StatusDot } from "./KasaLogo";
import { t } from "../locales/en";
import { NetworkHubModal } from "./NetworkHubModal";
import { getNetworkHostInfo } from "../services/networkHost";
import { useLocation } from "wouter";
import { isRemoteDataSource } from "../data";
import { useAuth } from "./AuthContext";
import { cn } from "../lib/cn";

export function Header({
  title,
  showSavedStatus = false,
}: {
  title: string;
  showSavedStatus?: boolean;
}) {
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const [, setLocation] = useLocation();
  const hostInfo = getNetworkHostInfo();
  const { currentStaff, openSwitchModal } = useAuth();

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
    toast(t.toasts.noNotifications);
  };

  return (
    <>
      <header className="app-header-light flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-5 py-3.5 md:px-8 shrink-0 bg-white text-ink">
        <div>
          <p className="label-caps text-[10px] font-medium text-white/55">
            {t.header.dateToday}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <h1 className="font-display text-xl font-bold tracking-tight text-white md:text-2xl">
              {title}
            </h1>
            {showSavedStatus && (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
                <StatusDot />
                {t.header.allSaved}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Local Server & Waiter Pairing Trigger */}
          <button
            type="button"
            onClick={() => setNetworkModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-2xs hover:border-white/30 hover:bg-white/15 transition-all"
            title="Buka Pusat Jaringan & Pairing HP Pelayan"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="flex items-center gap-1.5 text-white/85">
              <Radio size={14} className="text-success" />
              <span className="hidden sm:inline">Server Lokal:</span>
              <span className="font-mono text-[11px] text-white font-extrabold">{hostInfo.host}:{hostInfo.port}</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1 bg-accent px-1.5 py-0.5 rounded ml-0.5 text-[10px] font-extrabold text-ink">
              <Smartphone size={11} />
              Pair HP
            </span>
          </button>

          <IconButton label={t.header.notifications} onClick={handleNotifications}>
            <Bell size={19} />
          </IconButton>

          <div className="relative" ref={accountMenuRef}>
            <button
              ref={accountButtonRef}
              type="button"
              onClick={() => isRemoteDataSource ? setAccountMenuOpen((open) => !open) : openSwitchModal()}
              aria-expanded={isRemoteDataSource ? accountMenuOpen : undefined}
              aria-controls={isRemoteDataSource ? "account-menu" : undefined}
              aria-label={`Menu akun ${currentStaff.name}`}
              className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/10 pl-1 pr-3 py-1 shadow-2xs hover:border-white/30 hover:bg-white/15 transition-all"
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
                <p className="text-xs font-bold text-white leading-none">{currentStaff.name.split(" ")[0]}</p>
                <p className="text-[10px] font-semibold text-white/55 uppercase leading-tight mt-0.5">
                  {currentStaff.role}
                </p>
              </div>
              <ChevronDown size={14} className="text-white/45 group-hover:text-white transition-colors ml-0.5" />
            </button>
            {isRemoteDataSource && accountMenuOpen && (
              <div id="account-menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-ink/15 bg-white p-1.5 text-ink shadow-lg">
                {currentStaff.role === "admin" && (
                  <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-mineral focus-visible:outline-2 focus-visible:outline-accent" onClick={() => { setAccountMenuOpen(false); setLocation("/pengaturan"); }}>
                    <Users size={16} aria-hidden="true" /> Kelola akun staf
                  </button>
                )}
                <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-mineral focus-visible:outline-2 focus-visible:outline-accent" onClick={() => { setAccountMenuOpen(false); window.dispatchEvent(new Event("kasa-remote-logout")); }}>
                  <LogOut size={16} aria-hidden="true" /> Keluar / ganti akun
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Network & Pairing Hub Modal */}
      <NetworkHubModal
        open={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
      />
    </>
  );
}
