/**
 * Sección "Conceptos de la factura" del detalle CxP.
 *
 * Muestra las líneas fiscales del CFDI persistidas al capturar la factura
 * (vienen del XML del proveedor o de la extracción con IA sobre PDF).
 * Es sólo-lectura: la garantía fiscal se preserva.
 * v13.623.0 — formato invoice: columna Total por línea + caja de totales.
 */
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentoSectionTitle } from "@/components/shared/documento/DocumentoSectionTitle";
import { formatCurrency } from "@/lib/formatters";
import { totalLinea } from "@/features/cxp/utils/cuadreConceptos";
import {
  calcularResumenConceptos,
  totalLineaConImpuestos,
  type LineaConceptoResumen,
} from "@/features/cxp/utils/resumenConceptos";
import { ConceptosTotalesResumen } from "@/features/cxp/components/ConceptosTotalesResumen";
import { EditarConceptosButton } from "@/features/cxp/components/EditarConceptosButton";

import { useConceptosCfdiFactura, type ConceptoCfdiRow } from "@/features/cxp/hooks/useConceptosCfdiFactura";

import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead } from "@/components/shared/DetailTable";
interface Props {
  facturaId: string;
  moneda: string;
  /** Totales del documento para contrastar con la suma de las líneas. */
  retenciones?: number | null;
  total?: number | null;
  /** Datos para habilitar la edición de conceptos (facturas manuales). */
  edicion?: {
    folio: string;
    subtotal: number;
    uuidFiscal: string | null;
    archivoXmlUrl: string | null;
    estado: string;
    pagado: number;
  };
}

export function ConceptosFacturaSection({
  facturaId, moneda, retenciones, total, edicion,
}: Props) {
  const { data: conceptos = [], isLoading } = useConceptosCfdiFactura(facturaId);

  return (
    <section className="space-y-3">
      <DocumentoSectionTitle
        title="Conceptos de la factura"
        icon={<FileText className="h-4 w-4" />}
        count={conceptos.length}
        actions={edicion ? (
          <EditarConceptosButton
            facturaId={facturaId}
            moneda={moneda}
            folio={edicion.folio}
            subtotal={edicion.subtotal}
            uuidFiscal={edicion.uuidFiscal}
            archivoXmlUrl={edicion.archivoXmlUrl}
            estado={edicion.estado}
            pagado={edicion.pagado}
          />
        ) : undefined}
      />

      {isLoading ? (
        <Skeleton className="h-16 rounded-md" />
      ) : conceptos.length === 0 ? (
        <p className="text-body-sm text-muted-foreground rounded-md border bg-muted/20 px-3 py-3">
          Esta factura no tiene conceptos capturados del CFDI. Si el proveedor
          expide XML, vuelva a cargarlo desde "Adjuntar XML" para poblar el
          desglose fiscal.
        </p>
      ) : (
        <ConceptosTable
          conceptos={conceptos}
          moneda={moneda}
          retenciones={retenciones}
          total={total}
        />
      )}
    </section>
  );
}

function ConceptosTable({
  conceptos, moneda, retenciones, total,
}: {
  conceptos: ReadonlyArray<ConceptoCfdiRow>;
  moneda: string;
  retenciones?: number | null;
  total?: number | null;
}) {
  const lineas: LineaConceptoResumen[] = conceptos.map((c) => ({
    monto: Number(c.monto) || 0,
    cantidad: Number(c.cantidad) || 1,
    iva: Number(c.iva) || 0,
    ieps: Number(c.ieps) || 0,
  }));
  const resumen = calcularResumenConceptos(lineas, { retenciones, total });
  const hayIeps = resumen.ieps > 0;
  const totalConImpuestos = lineas.reduce((acc, l) => acc + totalLineaConImpuestos(l), 0);

  return (
    <div className="space-y-3">
      <div className="rounded-md border overflow-hidden">
        <p className="text-body-sm text-muted-foreground px-3 py-2 bg-muted/20 border-b">
          El importe es unitario; el total de cada línea es importe × cantidad (sin IVA).
        </p>
        <div className="max-h-72 overflow-y-auto overflow-x-auto">
          <Table className="w-full min-w-[640px] text-body-sm tabular-nums">
            <TableHeader className="bg-muted/50 text-muted-foreground uppercase tracking-wide text-label sticky top-0">
              <TableRow>
                <DetailTableHead className="w-8">#</DetailTableHead>
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
                <TableRow key={c.id} className="border-t odd:bg-background even:bg-muted/20 align-top">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="max-w-[360px]" title={c.descripcion}>
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
    </div>
  );
}
