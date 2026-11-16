import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatIDR } from "../../data/menu";
import { t } from "../../locales/id";
import { useProducts } from "../../state/catalog";
import { cn } from "../../lib/cn";
import { Input } from "../../ui/Input";

interface ScannerManualEntryProps {
  onSubmit: (code: string) => void;
}

const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "OK"] as const;

export function ScannerManualEntry({ onSubmit }: ScannerManualEntryProps) {
  const products = useProducts();
  const [code, setCode] = useState("");
  const query = code.trim();

  const match = useMemo(() => {
    if (!query) return undefined;
    const lower = query.toLowerCase();
    return products.find((product) => product.barcode === query || product.name.toLowerCase().includes(lower));
  }, [products, query]);

  const submit = (value: string) => {
    if (value.trim()) onSubmit(value);
  };

  const pressKey = (key: (typeof KEYPAD)[number]) => {
    if (key === "C") setCode("");
    else if (key === "OK") submit(code);
    else setCode((previous) => previous + key);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 p-6">
      <div className="rounded-2xl bg-surface p-4 text-ink">
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute bottom-3.5 left-3.5 text-text-light" />
          <Input
            autoFocus
            label={t.scanner.manual.label}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit(code);
              }
            }}
            placeholder={t.scanner.manual.placeholder}
            className="pl-10"
          />
        </div>

        {match ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-accent-dark">{match.name}</p>
              <p className="text-xs text-text-muted">{t.scanner.manual.price(formatIDR(match.price), match.barcode)}</p>
            </div>
            <button
              type="button"
              onClick={() => submit(match.barcode)}
              className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-bold text-white hover:bg-accent-dark"
            >
              {t.scanner.manual.add}
            </button>
          </div>
        ) : query ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3 text-xs text-text-muted">
            <span>{t.scanner.manual.noMatch(query)}</span>
            <button
              type="button"
              onClick={() => submit(code)}
              className="shrink-0 rounded-lg bg-ink px-3 py-1 font-semibold text-white hover:bg-ink-soft"
            >
              {t.scanner.manual.lookup}
            </button>
          </div>
        ) : null}
      </div>

      <div role="group" aria-label={t.scanner.manual.keypad} className="grid grid-cols-3 gap-1.5">
        {KEYPAD.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => pressKey(key)}
            aria-label={key === "C" ? t.scanner.manual.clear : key === "OK" ? t.scanner.manual.submit : undefined}
            className={cn(
              "h-11 rounded-xl text-sm font-bold transition-transform active:scale-95",
              key === "OK"
                ? "bg-accent text-white hover:bg-accent-dark"
                : key === "C"
                  ? "bg-error/20 text-error hover:bg-error/30"
                  : "bg-white/5 text-white hover:bg-white/10",
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
