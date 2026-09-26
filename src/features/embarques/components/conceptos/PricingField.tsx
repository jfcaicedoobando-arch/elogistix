import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Etiqueta visible en tarjetas estrechas; la cabecera de tabla la reemplaza en escritorio. */
export function PricingField({ label, children, className }: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("min-w-0 space-y-1 lg:space-y-0", className)}>
      <span className="block text-body-sm font-medium text-muted-foreground lg:sr-only">{label}</span>
      {children}
    </div>
  );
}
