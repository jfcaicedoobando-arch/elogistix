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

interface Props {
  aging: AgingMonedaProveedor[];
}

const TONO_BUCKET: Record<string, string> = {
  Vigente: "text-muted-foreground",
  "1-30": "text-warning",
  "31-60": "text-warning",
  "61-90": "text-destructive",
  "90+": "text-destructive",
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
              <span className="text-sm font-medium">{a.moneda}</span>
              <span className="text-kpi font-semibold tabular-nums">
                {formatCurrency(a.total, a.moneda)}
              </span>
            </div>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {a.conteo} factura(s) con saldo · vencido {formatCurrency(a.vencido, a.moneda)}
            </p>
            <dl className="mt-3 space-y-1">
              {BUCKETS_AGING_PROVEEDOR.map((b) => (
                <div key={b} className="flex items-center justify-between text-xs">
                  <dt className={TONO_BUCKET[b]}>{ETIQUETAS_BUCKET_PROVEEDOR[b]}</dt>
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
