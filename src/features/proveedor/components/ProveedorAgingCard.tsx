/**
 * Ola 2 — Antigüedad de saldos del proveedor (lo que le debemos, por edad).
 * Una tarjeta por moneda: nunca se mezclan divisas.
 */
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import {
  BUCKETS_AGING_PROVEEDOR,
  ETIQUETAS_BUCKET_PROVEEDOR,
  type AgingMonedaProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";
import { CUBETA_WIRE_TONO_KPI_PROVEEDOR } from "@/lib/aging/buckets";

interface Props {
  aging: AgingMonedaProveedor[];
}

/** Clase de color por tono KPI del catálogo central de cubetas. */
const CLASE_TONO: Record<string, string> = {
  default: "text-muted-foreground",
  warn: "text-warning",
  danger: "text-destructive",
};

export function ProveedorAgingCard({ aging }: Props) {
  if (aging.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-accent" />
          Antigüedad de saldos por pagar
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {aging.map((a) => (
          <div key={a.moneda} className="rounded-md border border-border p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-body font-medium">{a.moneda}</span>
              <span className="text-kpi font-semibold tabular-nums">
                {formatCurrency(a.total, a.moneda)}
              </span>
            </div>
            <p className="mt-0.5 text-label text-muted-foreground">
              {a.conteo} factura(s) con saldo · vencido {formatCurrency(a.vencido, a.moneda)}
            </p>
            <dl className="mt-3 space-y-1">
              {BUCKETS_AGING_PROVEEDOR.map((b) => (
                <div key={b} className="flex items-center justify-between text-body-sm">
                  <dt className={CLASE_TONO[CUBETA_WIRE_TONO_KPI_PROVEEDOR[b]]}>{ETIQUETAS_BUCKET_PROVEEDOR[b]}</dt>
                  <dd className="tabular-nums">{formatCurrency(a.buckets[b] ?? 0, a.moneda)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
