/**
 * Resumen visual de conceptos y totales de una proforma en el portal público.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { PortalProformaConcepto, PortalProformaData } from "@/features/proformas/services/portalPublico";

import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
import { etiquetaTratamientoFila } from "@/lib/financial/etiquetaTratamientoFila";
import { TASA_IVA } from "@/lib/financial/financialUtils";
import {
  AVISO_IVA_POR_CONFIRMAR,
  hayLineasIvaPorConfirmar,
} from "@/lib/financial/lineasPorConfirmarIva";

function fmtDinero(v: number | null | undefined, moneda: string | null | undefined): string {
  if (v == null) return "—";
  try {
    return formatCurrency(v, moneda || "MXN");
  } catch {
    return `${v} ${moneda ?? ""}`;
  }
}

function BloqueTotalesPortal({ moneda, subtotal, iva, total, estimado = false }: {
  moneda: string;
  subtotal: number | null;
  iva: number | null;
  total: number | null;
  estimado?: boolean;
}) {
  return (
    <div className="min-w-48 space-y-1 text-body">
      <div className="text-body-sm uppercase text-muted-foreground">{moneda}</div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{fmtDinero(subtotal, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span className="text-muted-foreground">IVA</span>
        <span>{fmtDinero(iva, moneda)}</span>
      </div>
      <div className="flex justify-between gap-6 text-base font-semibold border-t pt-2 mt-2">
        <span>{estimado ? "Total estimado" : "Total"}</span>
        <span>{fmtDinero(total, moneda)}</span>
      </div>
    </div>
  );
}

interface Props {
  proforma: PortalProformaData;
  conceptos: PortalProformaConcepto[];
}

export function PortalProformaResumen({ proforma, conceptos }: Props) {
  const moneda = proforma.moneda ?? "MXN";
  // P1 · Auditoría IVA: el portal no conoce la tasa de la organización, así que
  // se usa la tasa general del país como referencia SÓLO para detectar el caso
  // (renglón sin clasificar al que el cálculo ya aplicó IVA). No se recategoriza.
  const porConfirmar = hayLineasIvaPorConfirmar(conceptos, TASA_IVA);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de la proforma</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-body">
          <div>
            <div className="text-body-sm uppercase text-muted-foreground">Número</div>
            <div className="font-semibold">{proforma.numero ?? "—"}</div>
          </div>
          <div>
            <div className="text-body-sm uppercase text-muted-foreground">Embarque</div>
            <div className="font-semibold">{proforma.expediente ?? "—"}</div>
          </div>
          <div>
            <div className="text-body-sm uppercase text-muted-foreground">Cliente</div>
            <div className="font-semibold">{proforma.cliente_nombre ?? "—"}</div>
          </div>
          <div>
            <div className="text-body-sm uppercase text-muted-foreground">Moneda</div>
            <div className="font-semibold">{moneda}</div>
          </div>
        </div>

        {porConfirmar && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-body-sm text-destructive"
          >
            <span>{AVISO_IVA_POR_CONFIRMAR}</span>
          </div>
        )}

        {conceptos.length > 0 && (
          <div className="overflow-x-auto">
            <Table className="w-full text-body">
              <TableHeader>
                <TableRow className="border-b text-left text-body-sm uppercase text-muted-foreground">
                  <DetailTableHead className="pr-2">Descripción</DetailTableHead>
                  <DetailTableHead className="text-right">Cantidad</DetailTableHead>
                  <DetailTableHead className="text-right">P. unit.</DetailTableHead>
                  <DetailTableHead>IVA</DetailTableHead>
                  <DetailTableHead className="pl-2 text-right">Importe</DetailTableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conceptos.map((c) => (
                  <TableRow key={c.id} className="border-b last:border-0">
                    <TableCell className="pr-2">{c.descripcion ?? "—"}</TableCell>
                    <TableCell className="text-right">{c.cantidad ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtDinero(c.precio_unitario, c.moneda ?? moneda)}</TableCell>
                    <TableCell>{etiquetaTratamientoFila(c)}</TableCell>
                    <TableCell className="pl-2 text-right">{fmtDinero(c.importe, c.moneda ?? moneda)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* FIX4 N-2: si la proforma mezcla monedas se muestran los dos
            bloques duales (como la vista interna ProformaConceptosCard);
            si no, el bloque legacy singular derivado en el backend. */}
        {(proforma.subtotal_mxn ?? 0) > 0 && (proforma.subtotal_usd ?? 0) > 0 ? (
          <div className="border-t pt-3 flex flex-col sm:flex-row sm:justify-end gap-6">
            <BloqueTotalesPortal
              moneda="USD"
              subtotal={proforma.subtotal_usd}
              iva={proforma.iva_usd}
              total={proforma.total_usd}
              estimado={porConfirmar}
            />
            <BloqueTotalesPortal
              moneda="MXN"
              subtotal={proforma.subtotal_mxn}
              iva={proforma.iva_mxn}
              total={proforma.total_mxn}
              estimado={porConfirmar}
            />
          </div>
        ) : (
          <div className="border-t pt-3 space-y-1 text-body">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmtDinero(proforma.subtotal, moneda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span>{fmtDinero(proforma.iva, moneda)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t pt-2 mt-2">
              <span>{porConfirmar ? "Total estimado" : "Total"}</span>
              <span>{fmtDinero(proforma.total, moneda)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
