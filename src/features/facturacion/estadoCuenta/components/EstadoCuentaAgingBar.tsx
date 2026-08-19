/**
 * Barra de antigüedad de saldos (aging) al estilo QuickBooks: Corriente,
 * 1-30, 31-60, 61-90 y +90 días. Cada bucket es un filtro conmutable.
 */
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { AgingBucket, BucketAging } from "../services/estadoCuentaAging";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { CUBETAS_AGING, CUBETA_TONO_KPI } from "@/lib/aging/buckets";

interface Props {
  buckets: AgingBucket[];
  activo: BucketAging | null;
  onToggle: (b: BucketAging) => void;
}

/** Clase de color derivada del tono KPI del catálogo único de cubetas. */
const CLASE_TONO: Record<string, string> = {
  default: "text-muted-foreground",
  warn: "text-warning",
  danger: "text-destructive",
};
const TONO: Record<BucketAging, string> = Object.fromEntries(
  CUBETAS_AGING.map((c) => [c, CLASE_TONO[CUBETA_TONO_KPI[c]]]),
) as Record<BucketAging, string>;

function importes(b: AgingBucket): string[] {
  const out: string[] = [];
  if (b.mxn > 0) out.push(formatCurrency(b.mxn, "MXN"));
  if (b.usd > 0) out.push(formatCurrency(b.usd, "USD"));
  return out.length > 0 ? out : ["—"];
}

export function EstadoCuentaAgingBar({ buckets, activo, onToggle }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-4 py-2">
        <SectionHeading variant="overline">
          Antigüedad de saldos
        </SectionHeading>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        {buckets.map((b) => {
          const seleccionado = activo === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onToggle(b.id)}
              aria-pressed={seleccionado}
              className={cn(
                "px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                seleccionado ? "bg-accent/10" : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-medium text-muted-foreground">{b.label}</span>
                <span className="text-label tabular-nums text-muted-foreground">{b.conteo}</span>
              </div>
              <div className={cn("mt-1 space-y-0.5", TONO[b.id])}>
                {importes(b).map((txt) => (
                  <div key={txt} className="text-body font-semibold tabular-nums whitespace-nowrap">
                    {txt}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
