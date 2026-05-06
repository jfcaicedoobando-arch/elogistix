/**
 * Tarjeta interna del bloque "Cierre [Mes]" en TabProyeccion.
 * Sin lógica de negocio: recibe tono, líneas a renderizar y un footer opcional.
 */
import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CierreLinea {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}

interface Props {
  tone: "success" | "warning" | "info";
  icon: ElementType;
  titulo: string;
  embarques: number;
  lineas: CierreLinea[];
  footer?: ReactNode;
}

const TONE_STYLES: Record<Props["tone"], { bar: string; chip: string; text: string }> = {
  success: { bar: "bg-success", chip: "bg-success/10 text-success", text: "text-success" },
  warning: { bar: "bg-warning", chip: "bg-warning/10 text-warning", text: "text-warning" },
  info: { bar: "bg-primary", chip: "bg-primary/10 text-primary", text: "text-primary" },
};

export function CierreCard({ tone, icon: Icon, titulo, embarques, lineas, footer }: Props) {
  const s = TONE_STYLES[tone];
  return (
    <div className="relative rounded-xl border bg-card overflow-hidden">
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", s.bar)} />
      <div className="p-5 pl-6">
        <div className="flex items-center gap-2 mb-3">
          <div className={cn("rounded-lg p-1.5", s.chip)}>
            <Icon className="h-4 w-4" />
          </div>
          <h4 className={cn("text-xs font-semibold tracking-wide uppercase", s.text)}>{titulo}</h4>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">Embarques</span>
            <span className="text-2xl font-bold tabular-nums">{embarques}</span>
          </div>
          {lineas.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{l.label}</span>
              <span
                className={cn(
                  "tabular-nums whitespace-nowrap",
                  l.emphasis ? "text-lg font-semibold" : "text-sm font-medium",
                  l.className,
                )}
                title={l.value}
              >
                {l.value}
              </span>
            </div>
          ))}
        </div>
        {footer && <div className="mt-3 pt-3 border-t">{footer}</div>}
      </div>
    </div>
  );
}
