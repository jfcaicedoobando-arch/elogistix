/**
 * Sección Riesgo y cartera: antigüedad por bucket + concentración top 5.
 */
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { BucketAntiguedad, TopCliente } from "@/features/dashboard/direccion/services/tipos";

const COLOR_BUCKET: Record<BucketAntiguedad["bucket"], string> = {
  "Corriente": "bg-emerald-500",
  "1-30": "bg-amber-400",
  "31-60": "bg-orange-500",
  "+60": "bg-destructive",
};

function fmt(n: number): string { return formatCurrency(n, "MXN"); }

export function CarteraSection({ antiguedad, topClientes }: { antiguedad: BucketAntiguedad[]; topClientes: TopCliente[] }) {
  const total = antiguedad.reduce((s, b) => s + b.monto_mxn, 0);
  const totalPct = topClientes.reduce((s, c) => s + c.pct, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 rounded-xl border border-border">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Antigüedad de cartera</p>
          <p className="text-sm text-muted-foreground tabular-nums">Total: {fmt(total)}</p>
        </div>
        <ul className="mt-4 space-y-3">
          {antiguedad.map((b) => {
            const w = total > 0 ? (b.monto_mxn / total) * 100 : 0;
            return (
              <li key={b.bucket}>
                <div className="flex items-center justify-between text-sm">
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
          <p className="text-sm font-medium">Concentración — Top 5 clientes</p>
          <p className="text-sm text-muted-foreground tabular-nums">{totalPct.toFixed(1)}% del margen</p>
        </div>
        {topClientes.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">Sin datos del mes.</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {topClientes.map((c, i) => (
              <li key={(c.cliente_id ?? c.cliente_nombre) + i} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">
                  <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                  {c.cliente_nombre}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="tabular-nums text-muted-foreground">{fmt(c.utilidad_mxn)}</span>
                  <span className="tabular-nums font-medium w-14 text-right">{c.pct.toFixed(1)}%</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
