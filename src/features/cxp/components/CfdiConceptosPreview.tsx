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

import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
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
      <p className="text-body-sm text-muted-foreground -mt-1">
        Vista previa del desglose recibido del SAT. El importe es unitario; el
        total de cada línea es importe × cantidad (sin IVA).
      </p>
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-64 overflow-y-auto overflow-x-auto">
          <Table className="w-full min-w-[620px] text-body-sm tabular-nums">
            <TableHeader className="bg-muted/50 text-muted-foreground uppercase tracking-wide text-label sticky top-0">
              <TableRow>
                <DetailTableHead>#</DetailTableHead>
                <DetailTableHead>Descripción</DetailTableHead>
                <DetailTableHead className="text-right">Cant.</DetailTableHead>
                <DetailTableHead className="text-right">Importe unit.</DetailTableHead>
                <DetailTableHead className="text-right">Total línea</DetailTableHead>
                <DetailTableHead className="text-right">IVA</DetailTableHead>
                {hayIeps && <DetailTableHead className="text-right">IEPS</DetailTableHead>}
                <DetailTableHead className="text-right">Total</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((c, i) => (
                <TableRow key={i} className="border-t odd:bg-background even:bg-muted/20 align-top">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-[320px]" title={c.descripcion}>
                    <span className="line-clamp-2">
                    {c.descripcion || <span className="text-muted-foreground">(Sin descripción)</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{lineas[i].cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(lineas[i].monto, moneda)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totalLinea(lineas[i]), moneda)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(c.iva) || 0, moneda)}</TableCell>
                  {hayIeps && (
                    <TableCell className="text-right">{formatCurrency(Number(c.ieps) || 0, moneda)}</TableCell>
                  )}
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totalLineaConImpuestos(lineas[i]), moneda)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/40 font-semibold sticky bottom-0">
              <TableRow className="border-t">
                <TableCell colSpan={4}>Totales</TableCell>
                <TableCell className="text-right">{formatCurrency(resumen.subtotal, moneda)}</TableCell>
                <TableCell className="text-right">{formatCurrency(resumen.iva, moneda)}</TableCell>
                {hayIeps && <TableCell className="text-right">{formatCurrency(resumen.ieps, moneda)}</TableCell>}
                <TableCell className="text-right">{formatCurrency(totalConImpuestos, moneda)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
      <ConceptosTotalesResumen resumen={resumen} moneda={moneda} />
    </FormSection>
  );
}
