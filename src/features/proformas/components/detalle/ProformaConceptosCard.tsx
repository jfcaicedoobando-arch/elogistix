/**
 * Card de conceptos de la proforma con los totales integrados al pie de la
 * tabla (mismo patrón que `FacturaConceptosTable`), eliminando la tarjeta
 * "Totales" separada que duplicaba el total ya visible en el header.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatCurrency } from "@/lib/formatters";
import {
  buildConceptoColumns,
  monedaComun,
} from "@/features/proformas/components/detalle/conceptoColumns";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ConceptoVentaRow } from "@/features/proformas/services";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import {
  AVISO_IVA_POR_CONFIRMAR,
  hayLineasIvaPorConfirmar,
} from "@/lib/financial/lineasPorConfirmarIva";
import { AlertTriangle } from "lucide-react";
import { ProformaConceptoMobileCard } from "./ProformaConceptoMobileCard";

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
  estimado = false,
}: {
  moneda: "USD" | "MXN";
  subtotal: number;
  iva: number;
  total: number;
  /** Hay renglones con IVA por confirmar: el total no es definitivo. */
  estimado?: boolean;
}) {
  return (
    <div className="space-y-1 text-body">
      <p className="text-body-sm text-muted-foreground font-medium">{moneda}</p>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="tabular-nums">{formatCurrency(subtotal, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">IVA</span>
        <span className="tabular-nums">{formatCurrency(iva, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6 font-bold border-t pt-1">
        <span>{estimado ? "Total estimado" : "Total"}</span>
        <span className="tabular-nums text-accent">{formatCurrency(total, moneda)}</span>
      </div>
    </div>
  );
}

export function ProformaConceptosCard({ conceptos, totales, emptyMessage }: Props) {
  const moneda = useMemo(() => monedaComun(conceptos), [conceptos]);
  const columns = useMemo(() => buildConceptoColumns(moneda), [moneda]);
  const tasaIva = useTasaIVA();
  // P1 · Auditoría IVA: renglones heredados sin clasificar a los que el cálculo
  // aún aplica la tasa general ⇒ el total es estimado, no definitivo.
  const porConfirmar = hayLineasIvaPorConfirmar(conceptos, tasaIva);
  const hasUsd = totales.subtotal_usd > 0;
  const hasMxn = totales.subtotal_mxn > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>
          Conceptos {conceptos.length > 0 && (
            <span className="text-muted-foreground font-normal">({conceptos.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {porConfirmar && (
          <div
            role="alert"
            className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{AVISO_IVA_POR_CONFIRMAR}</span>
          </div>
        )}
        <ResponsiveDataTable
          columns={columns}
          data={conceptos}
          rowKey={(c) => c.id}
          density={TABLE_DENSITY.embebida}
          emptyMessage={emptyMessage}
          mobileCard={(concepto) => <ProformaConceptoMobileCard concepto={concepto} />}
        />
        {(hasUsd || hasMxn) && (
          <div className="flex flex-col sm:flex-row sm:justify-end gap-6 border-t px-4 py-3 bg-muted/30">
            {hasUsd && (
              <BloqueTotales
                moneda="USD"
                subtotal={totales.subtotal_usd}
                iva={totales.iva_usd}
                total={totales.total_usd}
                estimado={porConfirmar}
              />
            )}
            {hasMxn && (
              <BloqueTotales
                moneda="MXN"
                subtotal={totales.subtotal_mxn}
                iva={totales.iva_mxn}
                total={totales.total_mxn}
                estimado={porConfirmar}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
