/**
 * Resumen de conciliación (FIX C3c): conteos y montos pendientes calculados en
 * el servidor sobre TODOS los movimientos de la cuenta, no sólo los visibles.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConciliacionResumen } from "@/features/tesoreria/services";

interface Props {
  resumen?: ConciliacionResumen;
  moneda: string;
  isLoading: boolean;
  /** Saldo actual de la cuenta (saldo inicial + abonos - cargos). */
  saldo?: number;
}

export function ResumenConciliacionCards({ resumen, moneda, isLoading, saldo }: Props) {
  const items: Array<{ label: string; valor: string; tone?: string }> = resumen
    ? [
        {
          label: "Saldo actual",
          valor: saldo === undefined ? "—" : formatCurrency(saldo, moneda),
          tone: saldo !== undefined && saldo < 0 ? "text-destructive" : undefined,
        },
        { label: "Movimientos", valor: String(resumen.total_movimientos) },
        { label: "Pendientes", valor: String(resumen.pendientes), tone: "text-warning" },
        { label: "Conciliados", valor: String(resumen.conciliados), tone: "text-success" },
        { label: "Ignorados", valor: String(resumen.ignorados) },
        { label: "Cargos pendientes", valor: formatCurrency(resumen.cargos_pendientes, moneda) },
        { label: "Abonos pendientes", valor: formatCurrency(resumen.abonos_pendientes, moneda) },
      ]
    : [];

  return (
    <Card>
      <CardContent density="compact" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {isLoading || !resumen
          ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : items.map((it) => (
              <div key={it.label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${it.tone ?? ""}`}>{it.valor}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
