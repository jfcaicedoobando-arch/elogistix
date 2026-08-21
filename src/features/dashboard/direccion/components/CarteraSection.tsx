/**
 * Sección Riesgo y cartera: antigüedad por bucket + concentración top 5.
 */
import { Card } from "@/components/ui/card";
import { Users } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { formatCurrency, formatPercent} from "@/lib/formatters/numbers";
import type { BucketAntiguedad, TopCliente } from "@/features/dashboard/direccion/services/tipos";
import { AGING_FILL_CLASS } from "@/lib/aging/buckets";

// v13.682.0 · UI-2: relleno derivado de la escala única de antigüedad.
const COLOR_BUCKET: Record<BucketAntiguedad["bucket"], string> = {
  "Corriente": AGING_FILL_CLASS[1],
  "1-30": AGING_FILL_CLASS[2],
  "31-60": AGING_FILL_CLASS[3],
  "+60": AGING_FILL_CLASS[5],
};

function fmt(n: number): string { return formatCurrency(n, "MXN"); }

export function CarteraSection({ antiguedad, topClientes }: { antiguedad: BucketAntiguedad[]; topClientes: TopCliente[] }) {
  const total = antiguedad.reduce((s, b) => s + b.monto_mxn, 0);
  const totalPct = topClientes.reduce((s, c) => s + c.pct, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-baseline justify-between">
          <p className="text-body font-medium">Antigüedad de cartera</p>
          <p className="text-body text-muted-foreground tabular-nums">Total: {fmt(total)}</p>
        </div>
        <ul className="mt-4 space-y-3">
          {antiguedad.map((b) => {
            const w = total > 0 ? (b.monto_mxn / total) * 100 : 0;
            return (
              <li key={b.bucket}>
                <div className="flex items-center justify-between text-body">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${COLOR_BUCKET[b.bucket]}`} aria-hidden />
                    {b.bucket === "Corriente" ? "Corriente" : `${b.bucket} días`}
                    <span className="text-muted-foreground">({b.facturas})</span>
                  </span>
                  <span className="tabular-nums font-medium">{fmt(b.monto_mxn)}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-muted overflow-hidden">
                  <div className={`h-full ${COLOR_BUCKET[b.bucket]}`} style={{ width: `${w}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-baseline justify-between">
          <p className="text-body font-medium">Concentración — Top 5 clientes</p>
          <p className="text-body text-muted-foreground tabular-nums">{formatPercent(totalPct, 1)} del margen</p>
        </div>
        {topClientes.length === 0 ? (
          <EmptyStateInline icon={Users} message="Sin datos del mes." className="py-6" />
        ) : (
          <ol className="mt-4 space-y-2">
            {topClientes.map((c, i) => (
              <li key={(c.cliente_id ?? c.cliente_nombre) + i} className="flex items-center justify-between text-body">
                <span className="truncate pr-3">
                  <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                  {c.cliente_nombre}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums text-muted-foreground">{fmt(c.utilidad_mxn)}</span>
                  <span className="tabular-nums font-medium w-14 text-right">{formatPercent(c.pct, 1)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
