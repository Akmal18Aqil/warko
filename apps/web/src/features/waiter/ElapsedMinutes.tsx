import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../../locales/id";
import { ELAPSED_TICK_MS, MS_PER_MINUTE } from "./constants";

/** "Baru masuk" / "5 mnt lalu" label; owns the refresh timer so the surrounding tree never re-renders on a tick. */
export function ElapsedMinutes({ ts }: { ts: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.max(0, Math.floor((now - ts) / MS_PER_MINUTE));
  return (
    <span className="flex items-center gap-1 font-mono text-xs2 text-text-muted">
      <Clock size={12} aria-hidden="true" />
      {minutes === 0 ? t.waiter.justNow : t.waiter.minutesAgo(minutes)}
    </span>
  );
}
