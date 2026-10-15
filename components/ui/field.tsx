import type { ReactNode } from 'react';

/** Label wrapping its control, with an optional error line underneath. */
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
      {error ? <span className="text-sm font-normal text-destructive">{error}</span> : null}
    </label>
  );
}
