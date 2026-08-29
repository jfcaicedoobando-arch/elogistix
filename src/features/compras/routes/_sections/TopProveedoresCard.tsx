/**
 * Card "Top 10 proveedores por gasto" para /compras/reportes.
 * Extraído de `ComprasReportes.tsx` (v13.317.9).
 */
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { useExchangeRates } from "@/features/catalogos/hooks";

export interface TopProveedorRow {
  nombre: string;
  mxn: number;
  usd: number;
  eur: number;
  count: number;
  mxnEquiv: number;
}

interface Props {
  isLoading: boolean;
  rows: TopProveedorRow[];
}

export function TopProveedoresCard({ isLoading, rows }: Props) {
  // EC-10: el ranking ordena por equivalente en MXN; si el T/C es de respaldo
  // (17.25 operativo, no fiscal) el orden es estimado y hay que decirlo.
  const { data: rates } = useExchangeRates();
  const hayUsd = rows.some((r) => r.usd > 0);
  const tcEstimado = rates?.esFallback === true && hayUsd;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent" /> Top 10 proveedores por gasto
        </CardTitle>
        {tcEstimado ? (
          <p className="text-xs text-warning">
            Orden calculado con tipo de cambio estimado (no oficial): úsalo sólo como referencia.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <EmptyStateInline loading message="Cargando…" />
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Sin facturas en el período seleccionado.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((p, i) => (
              <div key={p.nombre + i} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                  <span className="truncate font-medium">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    ({p.count} {p.count === 1 ? "factura" : "facturas"})
                  </span>
                </div>
                <div className="flex gap-4 tabular-nums text-xs">
                  {p.mxn > 0 && <span>{formatCurrency(p.mxn, "MXN")}</span>}
                  {p.usd > 0 && <span>{formatCurrency(p.usd, "USD")}</span>}
                  {p.eur > 0 && <span>{formatCurrency(p.eur, "EUR")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
