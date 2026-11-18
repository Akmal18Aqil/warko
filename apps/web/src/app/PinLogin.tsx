import { CheckCircle2 } from "lucide-react";
import { useCallback, useState } from "react";
import { RemoteDataError } from "../data/api";
import type { DeviceStaff } from "../data/authApi";
import { cn } from "../lib/cn";
import { t } from "../locales/id";
import { PinPad, type PinResult } from "./PinPad";

type Props = {
  staff: DeviceStaff[];
  /** Highlighted as "Aktif" when the list is shown from inside a signed-in session. */
  currentId?: string;
  onSignIn: (staffId: string, pin: string) => Promise<void>;
};

/** Staff picker followed by the PIN pad of the chosen member; shared by the lock screen and the switch-user dialog. */
export function PinLogin({ staff, currentId, onSignIn }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(staff.length === 1 ? staff[0].id : null);
  const selected = staff.find((member) => member.id === selectedId) ?? null;

  const submit = useCallback(
    async (pin: string): Promise<PinResult> => {
      if (!selected) return { ok: false, message: t.app.pin.chooseStaffFirst };
      try {
        await onSignIn(selected.id, pin);
        return { ok: true };
      } catch (cause) {
        if (cause instanceof RemoteDataError) return { ok: false, message: cause.message, retryAfter: cause.retryAfter };
        return { ok: false, message: t.common.unknownError };
      }
    },
    [selected, onSignIn],
  );

  if (staff.length === 0) {
    return <p className="rounded-xl border border-ink/10 bg-mineral/40 p-4 text-sm text-ink/70">{t.app.pin.noStaffWithPin}</p>;
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-bold uppercase tracking-wider text-ink/60">{t.app.pin.chooseStaff}</legend>
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {staff.map((member) => {
            const isSelected = member.id === selectedId;
            return (
              <button
                key={member.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(member.id)}
                className={cn(
                  "relative flex min-h-14 items-center gap-2.5 overflow-hidden rounded-xl border p-2.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isSelected
                    ? "border-accent-dark bg-accent text-white shadow-md ring-2 ring-accent/50"
                    : "border-ink/10 bg-surface-muted/30 text-ink hover:border-ink/30 hover:bg-surface",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold shadow-2xs",
                    member.avatarColor,
                  )}
                >
                  {member.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold">{member.name}</span>
                    {member.id === currentId && (
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-2xs font-semibold",
                          isSelected ? "bg-surface text-accent-dark" : "bg-success/20 text-success-dark",
                        )}
                      >
                        {t.app.quickSwitch.active}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs2 font-medium opacity-80">{member.title}</span>
                </span>
                {isSelected && <CheckCircle2 size={15} aria-hidden="true" className="absolute right-2 top-2 text-white" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-2xl border border-ink/10 bg-mineral/30 p-4">
        {selected ? (
          <>
            <p className="text-center text-xs font-bold text-ink/70">
              {t.app.quickSwitch.enterPinFor} <span className="text-ink">{selected.name}</span>
            </p>
            <PinPad key={selected.id} onSubmit={submit} />
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink/60">{t.app.pin.chooseStaffFirst}</p>
        )}
      </div>
    </div>
  );
}
