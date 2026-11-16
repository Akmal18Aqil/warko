import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";
import { cn } from "../lib/cn";

type Size = "sm" | "md" | "lg";

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-9 min-h-9 px-3 text-xs",
  md: "h-11 min-h-11 px-3.5 text-sm",
  lg: "h-12 min-h-12 px-4 text-base",
};

const CONTROL_BASE =
  "block w-full rounded-lg border text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

function controlTone(error?: string): string {
  return error
    ? "border-error bg-surface text-error-dark focus:ring-error"
    : "border-border bg-surface hover:border-border-hover focus:border-accent/60";
}

interface FieldProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired with `htmlFor`, `aria-describedby` and `aria-invalid` by the controls below. */
function Field({ id, label, hint, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="block text-xs2 font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-2xs font-medium text-error-dark">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-2xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

type CommonProps = { label?: ReactNode; hint?: ReactNode; error?: string; wrapperClassName?: string };

export function Input({
  label,
  hint,
  error,
  wrapperClassName,
  size = "md",
  className,
  id,
  ...rest
}: CommonProps & Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: Size }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(CONTROL_BASE, controlTone(error), SIZE_CLASS[size], className)}
        {...rest}
      />
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  wrapperClassName,
  className,
  id,
  ...rest
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(CONTROL_BASE, controlTone(error), "px-3.5 py-2.5 text-sm", className)}
        {...rest}
      />
    </Field>
  );
}

export function Select({
  label,
  hint,
  error,
  wrapperClassName,
  size = "md",
  className,
  id,
  children,
  ...rest
}: CommonProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: Size }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Field id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(CONTROL_BASE, controlTone(error), SIZE_CLASS[size], className)}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
}
