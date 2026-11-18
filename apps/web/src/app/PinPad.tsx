import { Delete } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PIN_LENGTH } from "../data/authApi";
import { cn } from "../lib/cn";
import { t } from "../locales/id";

export type PinResult = { ok: true } | { ok: false; message: string; retryAfter?: number };

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
const KEY_CLASS =
  "flex h-12 items-center justify-center rounded-xl border border-ink/10 bg-surface text-ink shadow-2xs transition-all hover:border-ink/30 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50";
const SHAKE_MS = 600;

/**
 * Six-digit PIN entry: dots, touch keypad and physical keyboard. Submits on the last digit; `onSubmit` reports the
 * outcome. A throttled answer (`retryAfter`) locks the pad with a visible countdown. Remount it (`key`) per account.
 */
export function PinPad({ onSubmit, disabled = false }: { onSubmit: (pin: string) => Promise<PinResult>; disabled?: boolean }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = window.setTimeout(() => setWaitSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  const locked = disabled || busy || waitSeconds > 0;

  const submit = useCallback(
    async (value: string) => {
      setBusy(true);
      const result = await onSubmit(value);
      if (!mounted.current) return;
      setBusy(false);
      if (result.ok) {
        setPin("");
        return;
      }
      setError(result.message);
      setShaking(true);
      if (result.retryAfter) setWaitSeconds(result.retryAfter);
      window.setTimeout(() => {
        if (!mounted.current) return;
        setPin("");
        setShaking(false);
      }, SHAKE_MS);
    },
    [onSubmit],
  );

  const press = useCallback(
    (digit: string) => {
      if (locked || pin.length >= PIN_LENGTH) return;
      const next = pin + digit;
      setPin(next);
      setError("");
      if (next.length === PIN_LENGTH) void submit(next);
    },
    [locked, pin, submit],
  );

  const erase = useCallback(() => {
    if (locked) return;
    setPin((current) => current.slice(0, -1));
    setError("");
  }, [locked]);

  const clear = useCallback(() => {
    if (locked) return;
    setPin("");
    setError("");
  }, [locked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
        return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) press(event.key);
      else if (event.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press, erase]);

  const status = waitSeconds > 0 ? t.app.pin.waitFor(waitSeconds) : error;

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={t.app.pin.dotsLabel(pin.length, PIN_LENGTH)}
        className={cn("flex items-center justify-center gap-3 py-1", shaking && "animate-shake")}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => {
          const filled = pin.length > index;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list of identical dots.
              key={index}
              aria-hidden="true"
              className={cn(
                "h-3.5 w-3.5 rounded-full border-2 transition-all",
                filled ? "scale-110 border-accent-dark bg-accent shadow-xs" : "border-ink/25 bg-surface",
                status && "border-error-dark",
              )}
            />
          );
        })}
      </div>

      <p role="alert" className={cn("min-h-4 text-center text-xs font-bold text-error-dark", !status && "invisible")}>
        {status || "\u00A0"}
      </p>
      <p role="status" className="sr-only">
        {busy ? t.app.pin.checking : ""}
      </p>

      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={locked}
            onClick={() => press(digit)}
            aria-label={t.app.pin.digit(digit)}
            className={cn(KEY_CLASS, "font-display text-base font-bold")}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          disabled={locked}
          onClick={clear}
          className={cn(KEY_CLASS, "text-xs font-bold text-ink/60 hover:border-error/30 hover:bg-error/10 hover:text-error-dark")}
        >
          {t.app.pin.clear}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => press("0")}
          aria-label={t.app.pin.digit("0")}
          className={cn(KEY_CLASS, "font-display text-base font-bold")}
        >
          0
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={erase}
          aria-label={t.app.pin.deleteDigit}
          title={t.app.pin.deleteDigit}
          className={cn(KEY_CLASS, "text-ink/60 hover:text-ink")}
        >
          <Delete size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
