import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  open = true,
  onClose,
  children,
  className,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: ModalProps) {
  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (closeOnEscape && e.key === "Escape" && onClose) onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && e.target === e.currentTarget && onClose) onClose();
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm animate-in fade-in duration-140",
          className,
        )}
        onClick={handleBackdropClick}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            "w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200",
            className,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
      {closeOnEscape ? (
        <div
          className="fixed inset-0 z-[51] pointer-events-none"
          onKeyDown={handleKeyDown}
        />
      ) : null}
    </>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted shrink-0">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-base font-bold text-text">
          {title}
        </h2>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted hover:bg-ink/5 hover:text-text transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label="Tutup"
        >
          <span className="sr-only">Tutup</span>
          <span aria-hidden="true">✕</span>
        </button>
      )}
      {subtitle && (
        <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

export function ModalBody(children?: ReactNode) {
  return <div className="p-6 overflow-y-auto flex-1">{children}</div>;
}

export function ModalFooter(children?: ReactNode) {
  return (
    <div className="border-t border-border px-6 py-4 bg-surface-muted shrink-0 flex items-center justify-end gap-2">
      {children}
    </div>
  );
}
