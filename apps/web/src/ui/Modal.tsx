import { X } from "lucide-react";
import { createContext, type ReactNode, type RefObject, useContext, useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { t } from "../locales/id";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  "2xl": "max-w-6xl",
};

type ModalContextValue = { titleId: string; onClose: () => void };
const ModalContext = createContext<ModalContextValue | null>(null);

/** Open modals, bottom to top: only the topmost one reacts to Escape and Tab. */
const openStack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  /** Accessible name when the modal has no `ModalHeader` (otherwise the header title names the dialog). */
  ariaLabel?: string;
  size?: ModalSize;
  /** `sheet` slides up from the bottom edge on small screens. */
  placement?: "center" | "sheet";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** Element to focus on open; defaults to the first focusable element in the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Classes for the dialog panel. */
  className?: string;
  children?: ReactNode;
}

/**
 * The one overlay primitive: portal to `body`, `role="dialog"` + `aria-modal`, named by its header,
 * document-level Escape (topmost modal only), Tab focus trap, focus restored on close, page scroll locked.
 */
export function Modal({ open = true, ...props }: ModalProps) {
  return open ? <ModalPanel {...props} /> : null;
}

function ModalPanel({
  onClose,
  ariaLabel,
  size = "md",
  placement = "center",
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  className,
  children,
}: Omit<ModalProps, "open">) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscapeRef = useRef(closeOnEscape);
  closeOnEscapeRef.current = closeOnEscape;
  const contextValue = useMemo(() => ({ titleId, onClose: () => onCloseRef.current() }), [titleId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus handling runs once per open; a later `initialFocusRef` change must not steal focus.
  useEffect(() => {
    const id = Symbol("modal");
    openStack.push(id);
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const initial = initialFocusRef?.current ?? (panel ? focusableIn(panel)[0] : null) ?? panel;
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id || !panel) return;
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      const index = openStack.indexOf(id);
      if (index >= 0) openStack.splice(index, 1);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: pointer-only backdrop dismissal; keyboard users close the dialog with Escape or its close/cancel buttons.
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-ink/60 backdrop-blur-sm print:hidden",
        // On phones a sheet sits flush on the bottom edge; from `sm` up it is a centred dialog.
        placement === "sheet" ? "items-end pt-6 sm:items-center sm:p-4" : "items-center p-4",
      )}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      <ModalContext.Provider value={contextValue}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          className={cn(
            "flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl outline-none animate-modal-in",
            SIZE_CLASS[size],
            placement === "sheet" && "max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[env(safe-area-inset-bottom)]",
            className,
          )}
        >
          {children}
        </div>
      </ModalContext.Provider>
    </div>,
    document.body,
  );
}

interface ModalHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Leading icon or avatar. */
  icon?: ReactNode;
  /** Extra controls placed before the close button. */
  actions?: ReactNode;
  className?: string;
}

export function ModalHeader({ title, subtitle, icon, actions, className }: ModalHeaderProps) {
  const context = useContext(ModalContext);
  if (!context) throw new Error("ModalHeader harus dipakai di dalam Modal");
  return (
    <div className={cn("flex shrink-0 items-start justify-between gap-3 border-b border-border bg-surface-muted px-6 py-4", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <h2 id={context.titleId} className="font-display text-base font-bold text-ink">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs2 text-text-muted">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <button
          type="button"
          onClick={context.onClose}
          aria-label={t.common.close}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function ModalBody({ children, className }: { children?: ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-6", className)}>{children}</div>;
}

export function ModalFooter({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface-muted px-6 py-4", className)}>
      {children}
    </div>
  );
}
