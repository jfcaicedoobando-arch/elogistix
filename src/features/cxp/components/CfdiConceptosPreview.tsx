/**
 * Vista previa de los conceptos extraídos del XML CFDI antes de confirmar el
 * registro de la factura de proveedor. Solo lectura: refleja fielmente lo que
 * viene del SAT (la garantía fiscal se preserva).
 *
 * Al guardar la factura, estas líneas se persisten en
 * `proveedor_facturas_conceptos` (con `concepto_costo_id = NULL`) como
 * respaldo auditable del desglose fiscal recibido.
 * v13.623.0 — formato invoice: columna Total por línea + caja de totales.
 */
import { FileText } from "lucide-react";
import { FormSection } from "./facturaFormPrimitives";
import { formatCurrency } from "@/lib/formatters";
import { totalLinea } from "@/features/cxp/utils/cuadreConceptos";
import {
  calcularResumenConceptos,
  totalLineaConImpuestos,
  type LineaConceptoResumen,
} from "@/features/cxp/utils/resumenConceptos";
import { ConceptosTotalesResumen } from "./ConceptosTotalesResumen";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

interface Props {
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
  moneda: string;
}

export function CfdiConceptosPreview({ conceptos, moneda }: Props) {
  if (conceptos.length === 0) return null;

  const lineas: LineaConceptoResumen[] = conceptos.map((c) => ({
    monto: Number(c.importe) || 0,
    cantidad: Number(c.cantidad ?? 1) || 1,
    iva: Number(c.iva) || 0,
    ieps: Number(c.ieps) || 0,
  }));
  const resumen = calcularResumenConceptos(lineas);
  const hayIeps = resumen.ieps > 0;
  const totalConImpuestos = lineas.reduce((acc, l) => acc + totalLineaConImpuestos(l), 0);

  return (
    <FormSection
      icon={<FileText className="h-3.5 w-3.5" />}
      title={`Conceptos del CFDI (${conceptos.length})`}
    >
      <p className="text-xs text-muted-foreground -mt-1">
        Vista previa del desglose recibido del SAT. El importe es unitario; el
        total de cada línea es importe × cantidad (sin IVA).
      </p>
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-64 overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs tabular-nums">
            <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wide text-2xs sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Descripción</th>
                <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                <th className="px-2 py-1.5 text-right font-medium">Importe unit.</th>
                <th className="px-2 py-1.5 text-right font-medium">Total línea</th>
                <th className="px-2 py-1.5 text-right font-medium">IVA</th>
                {hayIeps && <th className="px-2 py-1.5 text-right font-medium">IEPS</th>}
                <th className="px-2 py-1.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {conceptos.map((c, i) => (
                <tr key={i} className="border-t odd:bg-background even:bg-muted/20 align-top">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 max-w-[320px]" title={c.descripcion}>
                    <span className="line-clamp-2">
                    {c.descripcion || <span className="text-muted-foreground">(Sin descripción)</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right">{lineas[i].cantidad}</td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(lineas[i].monto, moneda)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {formatCurrency(totalLinea(lineas[i]), moneda)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(Number(c.iva) || 0, moneda)}</td>
                  {hayIeps && (
                    <td className="px-2 py-1.5 text-right">{formatCurrency(Number(c.ieps) || 0, moneda)}</td>
                  )}
                  <td className="px-2 py-1.5 text-right font-semibold">
                    {formatCurrency(totalLineaConImpuestos(lineas[i]), moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 font-semibold sticky bottom-0">
              <tr className="border-t">
                <td className="px-2 py-1.5" colSpan={4}>Totales</td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(resumen.subtotal, moneda)}</td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(resumen.iva, moneda)}</td>
                {hayIeps && <td className="px-2 py-1.5 text-right">{formatCurrency(resumen.ieps, moneda)}</td>}
                <td className="px-2 py-1.5 text-right">{formatCurrency(totalConImpuestos, moneda)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <ConceptosTotalesResumen resumen={resumen} moneda={moneda} />
    </FormSection>
  );
}
