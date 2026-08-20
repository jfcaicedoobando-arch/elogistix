/**
 * Tarjeta interna del bloque "Cierre [Mes]" en TabProyeccion.
 * Sin lógica de negocio: recibe tono, líneas a renderizar y un footer opcional.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/shared/KpiCard";
import type { KpiVariant } from "@/components/shared/kpiCard.tokens";
import type { LucideIcon } from "lucide-react";
import { Hint } from "@/components/shared/Hint";

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
            <span className="text-body-sm text-muted-foreground whitespace-nowrap">{l.label}</span>
            <Hint label={l.value}>
              <span
                className={cn(
                  "tabular-nums whitespace-nowrap",
                  l.emphasis ? "text-lg font-semibold" : "text-body font-medium",
                  l.className,
                )}
              >
                {l.value}
              </span>
            </Hint>
          </div>
        ))}
      </div>
      {footer && <div className="mt-3 pt-3 border-t">{footer}</div>}
    </KpiCard>
  );
}
