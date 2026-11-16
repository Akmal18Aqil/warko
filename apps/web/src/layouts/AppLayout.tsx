import type { ReactNode } from "react";
import { Sidebar, MobileNav } from "../components/Sidebar";
import { usePos } from "../components/PosContext";
import { cn } from "../lib/cn";
interface AppLayoutProps {
  children?: ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const { dataSourceError } = usePos();
  return (
    <div className={cn("screen-root flex min-h-screen bg-mineral", className)}>
      <Sidebar />
      <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
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
