import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { isDemoMode } from "../state/demo";
import { useDataSourceError } from "../state/session";
import { DemoBanner } from "./DemoBanner";
import { MobileNav, Sidebar } from "./Sidebar";

interface AppLayoutProps {
  children?: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const dataSourceError = useDataSourceError();
  return (
    <div className={cn("screen-root flex min-h-screen bg-mineral", className)}>
      <Sidebar />
      <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {isDemoMode && <DemoBanner />}
        {dataSourceError && (
          <div role="alert" className="border-b border-error/20 bg-error/10 px-5 py-3 text-sm font-semibold text-error md:px-8">
            {dataSourceError}
          </div>
        )}
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
