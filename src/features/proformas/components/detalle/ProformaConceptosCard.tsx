/**
 * Card de conceptos de la proforma con los totales integrados al pie de la
 * tabla (mismo patrón que `FacturaConceptosTable`), eliminando la tarjeta
 * "Totales" separada que duplicaba el total ya visible en el header.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import {
  buildConceptoColumns,
  monedaComun,
} from "@/features/proformas/components/detalle/conceptoColumns";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ConceptoVentaRow } from "@/features/proformas/services";

type Totales = ReturnType<typeof calcularTotalesProforma>;

interface Props {
  conceptos: ConceptoVentaRow[];
  totales: Totales;
  emptyMessage: string;
}

function BloqueTotales({
  moneda,
  subtotal,
  iva,
  total,
}: {
  moneda: "USD" | "MXN";
  subtotal: number;
  iva: number;
  total: number;
}) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-xs text-muted-foreground font-medium">{moneda}</p>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums">{formatCurrency(subtotal, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">IVA</span>
        <span className="tabular-nums">{formatCurrency(iva, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6 font-bold border-t pt-1">
        <span>Total</span>
        <span className="tabular-nums text-accent">{formatCurrency(total, moneda)}</span>
      </div>
    </div>
  );
}

export function ProformaConceptosCard({ conceptos, totales, emptyMessage }: Props) {
  const moneda = useMemo(() => monedaComun(conceptos), [conceptos]);
  const columns = useMemo(() => buildConceptoColumns(moneda), [moneda]);
  const hasUsd = totales.subtotal_usd > 0;
  const hasMxn = totales.subtotal_mxn > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Conceptos {conceptos.length > 0 && (
            <span className="text-muted-foreground font-normal">({conceptos.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={conceptos}
          rowKey={(c) => c.id}
          density="compact"
          emptyMessage={emptyMessage}
        />
        {(hasUsd || hasMxn) && (
          <div className="flex flex-col sm:flex-row sm:justify-end gap-6 border-t px-4 py-3 bg-muted/30">
            {hasUsd && (
              <BloqueTotales
                moneda="USD"
                subtotal={totales.subtotal_usd}
                iva={totales.iva_usd}
                total={totales.total_usd}
              />
            )}
            {hasMxn && (
              <BloqueTotales
                moneda="MXN"
                subtotal={totales.subtotal_mxn}
                iva={totales.iva_mxn}
                total={totales.total_mxn}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
