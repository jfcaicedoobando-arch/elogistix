/**
 * Barra de antigüedad de saldos (aging) al estilo QuickBooks: Corriente,
 * 1-30, 31-60, 61-90 y +90 días. Cada bucket es un filtro conmutable.
 */
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { AgingBucket, BucketAging } from "../services/estadoCuentaAging";

interface Props {
  buckets: AgingBucket[];
  activo: BucketAging | null;
  onToggle: (b: BucketAging) => void;
}

const TONO: Record<BucketAging, string> = {
  corriente: "text-muted-foreground",
  "1-30": "text-warning",
  "31-60": "text-warning",
  "61-90": "text-destructive",
  "90+": "text-destructive",
};

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
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Antigüedad de saldos
        </h2>
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
                <span className="text-xs font-medium text-muted-foreground">{b.label}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{b.conteo}</span>
              </div>
              <div className={cn("mt-1 space-y-0.5", TONO[b.id])}>
                {importes(b).map((txt) => (
                  <div key={txt} className="text-sm font-semibold tabular-nums whitespace-nowrap">
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
