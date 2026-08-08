/**
 * KPIs del libro maestro de pagos: cobrado, pagado, neto y número de pagos.
 * Todos los importes se muestran en MXN al tipo de cambio de cada pago.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import type { TotalesLibroPagos } from "@/features/tesoreria/domain/libroPagos";

interface Props {
  totales: TotalesLibroPagos;
  isLoading: boolean;
}

export function LibroPagosKpis({ totales, isLoading }: Props) {
  const items = [
    { label: "Cobrado a clientes", valor: formatCurrency(totales.cobradoMxn, "MXN"), tone: "text-success" },
    { label: "Pagado a proveedores", valor: formatCurrency(totales.pagadoMxn, "MXN"), tone: "text-destructive" },
    {
      label: "Neto del periodo",
      valor: formatCurrency(totales.netoMxn, "MXN"),
      tone: totales.netoMxn < 0 ? "text-destructive" : undefined,
    },
    { label: "Pagos registrados", valor: String(totales.conteo) },
  ];

  return (
    <div className="space-y-2">
      <Card>
        <CardContent density="compact" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            : items.map((it) => (
                <div key={it.label}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</p>
                  <p className={`mt-1 text-lg font-semibold tabular-nums ${it.tone ?? ""}`}>{it.valor}</p>
                </div>
              ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Los equivalentes en pesos usan el tipo de cambio guardado en cada pago, no el del día de hoy.
      </p>
    </div>
  );
}
