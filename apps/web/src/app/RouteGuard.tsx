import { ArrowLeft, KeyRound, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { isRemoteDataSource } from "../data/api";
import { cn } from "../lib/cn";
import { t } from "../locales/id";
import { useAuth } from "../state/auth";
import { Button } from "../ui/Button";
import { Header } from "./Header";

interface RouteGuardProps {
  path: string;
  children: ReactNode;
  moduleName?: string;
}

export function RouteGuard({ path, children, moduleName = t.app.guard.defaultModule }: RouteGuardProps) {
  const { currentStaff, hasAccessTo, openSwitchModal, getAllowedDefaultRoute } = useAuth();
  const [, setLocation] = useLocation();

  const allowed = hasAccessTo(path);

  if (allowed) {
    return <>{children}</>;
  }

  const defaultRoute = getAllowedDefaultRoute(currentStaff.role);

  return (
    <div className="flex min-h-screen flex-col bg-mineral">
      <Header title={t.app.guard.pageTitle} />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-ink/10 bg-surface p-8 text-center shadow-xl animate-modal-in">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/20 text-warning-dark mb-5 shadow-xs">
            <Lock size={32} />
          </div>

          <h2 className="font-display text-xl font-bold text-ink">{t.app.guard.lockedTitle}</h2>

          <p className="mt-2 text-xs text-ink/65 leading-relaxed">{t.app.guard.body(moduleName)}</p>

          <div className="mt-4 flex items-center justify-center gap-2.5 rounded-xl bg-mineral/50 border border-ink/10 p-3">
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold",
                currentStaff.avatarColor,
              )}
            >
              {currentStaff.initials}
            </span>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-ink">{currentStaff.name}</p>
              <p className="text-xs2 text-ink/50 uppercase font-semibold">{currentStaff.title}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            <Button variant="primary" onClick={openSwitchModal} className="w-full gap-2 font-bold justify-center">
              <KeyRound size={16} />
              {isRemoteDataSource ? t.app.header.logout : t.app.guard.switchStaff}
            </Button>

            <Button variant="outline" onClick={() => setLocation(defaultRoute)} className="w-full gap-2 text-xs justify-center">
              <ArrowLeft size={14} />
              {t.app.guard.backTo(currentStaff.title)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
