import type { ReactNode } from "react";

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0 gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right inline-flex items-center gap-2 justify-end">{value}</span>
    </div>
  );
}
