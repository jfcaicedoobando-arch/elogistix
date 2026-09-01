/**
 * Vista previa de los conceptos extraídos del documento antes de confirmar el
 * registro de la factura de proveedor.
 *
 * - Origen XML CFDI: SÓLO LECTURA (refleja fielmente lo que viene del SAT).
 * - Origen PDF con IA (v13.823.21): editable — la IA puede proponer renglones
 *   de más y se corrigen aquí, antes de guardar.
 *
 * Al guardar la factura, estas líneas se persisten en
 * `proveedor_facturas_conceptos` (con `concepto_costo_id = NULL`).
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
import { CfdiConceptoIaRow } from "./CfdiConceptoIaRow";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
import { Hint } from "@/components/shared/Hint";

interface Props {
  conceptos: ReadonlyArray<CfdiConceptoParsed>;
  moneda: string;
  /** Sólo para origen PDF con IA: habilita la edición de los renglones. */
  onEditar?: (idx: number, patch: Partial<CfdiConceptoParsed>) => void;
  onEliminar?: (idx: number) => void;
}

export function CfdiConceptosPreview({ conceptos, moneda, onEditar, onEliminar }: Props) {
  if (conceptos.length === 0) return null;
  const editable = Boolean(onEditar && onEliminar);

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
      title={`${editable ? "Conceptos extraídos por IA" : "Conceptos del CFDI"} (${conceptos.length})`}
    >
      <p className="text-body-sm text-muted-foreground -mt-1">
        {editable
          ? "Revisa el desglose que propuso la IA: corrige los datos o borra los renglones de más antes de guardar. El importe es unitario; el total de cada línea es importe × cantidad (sin IVA)."
          : "Vista previa del desglose recibido del SAT. El importe es unitario; el total de cada línea es importe × cantidad (sin IVA)."}
      </p>
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <Table className="w-full text-body-sm tabular-nums">
            <TableHeader className="bg-muted/50 text-muted-foreground uppercase tracking-wide text-label sticky top-0">
              <TableRow>
                <DetailTableHead>#</DetailTableHead>
                <DetailTableHead>Descripción</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Cant.</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Importe unit.</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Total línea</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">IVA</DetailTableHead>
                {hayIeps && <DetailTableHead className="text-right whitespace-nowrap">IEPS</DetailTableHead>}
                <DetailTableHead className="text-right whitespace-nowrap">Total</DetailTableHead>
                {editable && <DetailTableHead className="text-right"><span className="sr-only">Acciones</span></DetailTableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((c, i) => (
                editable ? (
                  <CfdiConceptoIaRow
                    key={i}
                    indice={i}
                    concepto={c}
                    linea={lineas[i]}
                    moneda={moneda}
                    hayIeps={hayIeps}
                    onEditar={(patch) => onEditar?.(i, patch)}
                    onEliminar={() => onEliminar?.(i)}
                  />
                ) : (
                  <TableRow key={i} className="border-t odd:bg-background even:bg-muted/20 align-top">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <Hint label={c.descripcion}>
                      <TableCell className="min-w-[220px] whitespace-normal break-words">
                        <span className="line-clamp-3">
                          {c.descripcion || <span className="text-muted-foreground">(Sin descripción)</span>}
                        </span>
                      </TableCell>
                    </Hint>
                    <TableCell className="text-right whitespace-nowrap">{lineas[i].cantidad}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(lineas[i].monto, moneda)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatCurrency(totalLinea(lineas[i]), moneda)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(c.iva) || 0, moneda)}</TableCell>
                    {hayIeps && (
                      <TableCell className="text-right whitespace-nowrap">{formatCurrency(Number(c.ieps) || 0, moneda)}</TableCell>
                    )}
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {formatCurrency(totalLineaConImpuestos(lineas[i]), moneda)}
                    </TableCell>
                  </TableRow>
                )
              ))}
            </TableBody>
            <TableFooter className="bg-muted/40 font-semibold sticky bottom-0">
              <TableRow className="border-t">
                <TableCell colSpan={4}>Totales</TableCell>
                <TableCell className="text-right">{formatCurrency(resumen.subtotal, moneda)}</TableCell>
                <TableCell className="text-right">{formatCurrency(resumen.iva, moneda)}</TableCell>
                {hayIeps && <TableCell className="text-right">{formatCurrency(resumen.ieps, moneda)}</TableCell>}
                <TableCell className="text-right">{formatCurrency(totalConImpuestos, moneda)}</TableCell>
                {editable && <TableCell />}
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
      <ConceptosTotalesResumen resumen={resumen} moneda={moneda} />
    </FormSection>
  );
}
