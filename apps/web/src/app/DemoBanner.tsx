import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { ResetDemoModal } from "../features/settings/ResetDemoModal";
import { t } from "../locales/id";

/** Slim, always-visible strip of the local demo: what the data is and a shortcut to reset it. */
export function DemoBanner() {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-warning/40 bg-warning/10 px-5 py-1.5 text-xs text-warning-dark md:px-8">
      <span className="inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-2xs font-extrabold tracking-wider text-ink">
        <FlaskConical size={11} aria-hidden="true" />
        {t.app.demo.label}
      </span>
      <span className="font-medium">{t.app.demo.banner}</span>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded font-bold underline underline-offset-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {t.app.demo.reset}
      </button>
      {confirming && <ResetDemoModal onClose={() => setConfirming(false)} />}
    </div>
  );
}
