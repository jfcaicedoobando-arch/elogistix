/**
 * Tarjeta interna del bloque "Cierre [Mes]" en TabProyeccion.
 * Sin lógica de negocio: recibe tono, líneas a renderizar y un footer opcional.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/shared/KpiCard";
import type { KpiVariant } from "@/components/shared/kpiCard.tokens";
import type { LucideIcon } from "lucide-react";

export interface CierreLinea {
  label: string;
  value: string;
  emphasis?: boolean;
  className?: string;
}

interface Props {
  tone: "success" | "warning" | "info";
  icon: LucideIcon;
  titulo: string;
  embarques: number;
  lineas: CierreLinea[];
  footer?: ReactNode;
}

const TONE_TO_VARIANT: Record<Props["tone"], KpiVariant> = {
  success: "success",
  warning: "warning",
  info: "info",
};

export function CierreCard({ tone, icon, titulo, embarques, lineas, footer }: Props) {
  return (
    <KpiCard
      label={titulo}
      value={embarques}
      sublabel="Embarques"
      icon={icon}
      iconVariant="chip"
      variant={TONE_TO_VARIANT[tone]}
    >
      <div className="mt-2 space-y-1">
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
    </KpiCard>
  );
}
