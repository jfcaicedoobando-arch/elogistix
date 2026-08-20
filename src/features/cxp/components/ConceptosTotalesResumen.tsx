/**
 * Caja de totales tipo "invoice" para las tablas de conceptos de factura de
 * proveedor (detalle y vista previa del CFDI). Sólo presentación.
 */
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ResumenConceptos } from "@/features/cxp/utils/resumenConceptos";

interface Props {
  resumen: ResumenConceptos;
  moneda: string;
}

function Fila({
  label, valor, moneda, negativo, fuerte,
}: { label: string; valor: number; moneda: string; negativo?: boolean; fuerte?: boolean }) {
  return (
    <div
      className={
        fuerte
          ? "flex items-center justify-between gap-6 bg-primary px-3 py-2 text-primary-foreground"
          : "flex items-center justify-between gap-6 px-3 py-1.5"
      }
    >
      <span className={fuerte ? "text-body-sm font-semibold uppercase tracking-wide" : "text-body-sm text-muted-foreground"}>
        {label}
      </span>
      <span className={fuerte ? "text-body font-semibold tabular-nums" : "text-body-sm font-medium tabular-nums"}>
        {negativo && valor > 0 ? "−" : ""}
        {formatCurrency(Math.abs(valor), moneda)}
      </span>
    </div>
  );
}

export function ConceptosTotalesResumen({ resumen, moneda }: Props) {
  return (
    <div className="flex justify-end">
      <div className="w-full sm:w-72 overflow-hidden rounded-md border">
        <Fila label={`Subtotal ${moneda}`} valor={resumen.subtotal} moneda={moneda} />
        <Fila label={`IVA ${moneda}`} valor={resumen.iva} moneda={moneda} />
        {resumen.ieps > 0 && <Fila label={`IEPS ${moneda}`} valor={resumen.ieps} moneda={moneda} />}
        {resumen.retenciones > 0 && (
          <Fila label={`Retenciones ${moneda}`} valor={resumen.retenciones} moneda={moneda} negativo />
        )}
        <Fila label={`Total ${moneda}`} valor={resumen.total} moneda={moneda} fuerte />
        {!resumen.cuadra && (
          <div className="flex items-start gap-2 bg-warning/10 px-3 py-2 text-label text-warning">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>
              Los conceptos suman {formatCurrency(resumen.totalCalculado, moneda)}; el total de la
              factura difiere en {formatCurrency(Math.abs(resumen.diferencia), moneda)}. Puede haber
              descuentos o conceptos faltantes en el CFDI.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
