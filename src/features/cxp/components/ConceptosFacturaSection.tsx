/**
 * Sección "Conceptos de la factura" del detalle CxP.
 *
 * Muestra las líneas fiscales del CFDI persistidas al capturar la factura
 * (vienen del XML del proveedor o de la extracción con IA sobre PDF).
 * Es sólo-lectura: la garantía fiscal se preserva.
 */
import { FileText } from "lucide-react";
import { DocumentoSectionTitle } from "@/components/shared/documento/DocumentoSectionTitle";
import { formatCurrency } from "@/lib/formatters";
import { useConceptosCfdiFactura, type ConceptoCfdiRow } from "@/features/cxp/hooks/useConceptosCfdiFactura";

interface Props {
  facturaId: string;
  moneda: string;
}

function sum(xs: ReadonlyArray<number>): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function ConceptosFacturaSection({ facturaId, moneda }: Props) {
  const { data: conceptos = [], isLoading } = useConceptosCfdiFactura(facturaId);

  return (
    <section className="space-y-3">
      <DocumentoSectionTitle
        title="Conceptos de la factura"
        icon={<FileText className="h-4 w-4" />}
        count={conceptos.length}
      />

      {isLoading ? (
        <div className="h-16 rounded-md border bg-muted/20 animate-pulse" />
      ) : conceptos.length === 0 ? (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/20 px-3 py-3">
          Esta factura no tiene conceptos capturados del CFDI. Si el proveedor
          expide XML, vuelva a cargarlo desde "Adjuntar XML" para poblar el
          desglose fiscal.
        </p>
      ) : (
        <ConceptosTable conceptos={conceptos} moneda={moneda} />
      )}
    </section>
  );
}

function ConceptosTable({
  conceptos, moneda,
}: { conceptos: ReadonlyArray<ConceptoCfdiRow>; moneda: string }) {
  const lineas = conceptos.map((c) => ({
    monto: Number(c.monto) || 0,
    cantidad: Number(c.cantidad) || 1,
  }));
  const totImporte = sumarConceptos(lineas);
  const totIva = sum(conceptos.map((c) => Number(c.iva) || 0));
  const totIeps = sum(conceptos.map((c) => Number(c.ieps) || 0));
  const hayIeps = totIeps > 0;

  return (
    <div className="rounded-md border overflow-hidden">
      <p className="text-xs text-muted-foreground px-3 py-2 bg-muted/20 border-b">
        El importe es unitario; el total de cada línea es importe × cantidad (sin IVA).
      </p>
      <div className="max-h-72 overflow-y-auto">
        <table className="w-full text-xs tabular-nums">
          <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wide text-2xs sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium w-8">#</th>
              <th className="px-2 py-1.5 text-left font-medium">Descripción</th>
              <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
              <th className="px-2 py-1.5 text-right font-medium">Importe unit.</th>
              <th className="px-2 py-1.5 text-right font-medium">Total línea</th>
              <th className="px-2 py-1.5 text-right font-medium">IVA</th>
              {hayIeps && <th className="px-2 py-1.5 text-right font-medium">IEPS</th>}
            </tr>
          </thead>
          <tbody>
            {conceptos.map((c, i) => (
              <tr key={c.id} className="border-t odd:bg-background even:bg-muted/20">
                <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-2 py-1.5 max-w-[360px] truncate" title={c.descripcion}>
                  {c.descripcion || <span className="text-muted-foreground">(Sin descripción)</span>}
                </td>
                <td className="px-2 py-1.5 text-right">{lineas[i].cantidad}</td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(lineas[i].monto, moneda)}</td>
                <td className="px-2 py-1.5 text-right font-medium">
                  {formatCurrency(totalLinea(lineas[i]), moneda)}
                </td>
                <td className="px-2 py-1.5 text-right">{formatCurrency(Number(c.iva) || 0, moneda)}</td>
                {hayIeps && (
                  <td className="px-2 py-1.5 text-right">{formatCurrency(Number(c.ieps) || 0, moneda)}</td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/40 font-semibold sticky bottom-0">
            <tr className="border-t">
              <td className="px-2 py-1.5" colSpan={4}>Totales</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(totImporte, moneda)}</td>
              <td className="px-2 py-1.5 text-right">{formatCurrency(totIva, moneda)}</td>
              {hayIeps && <td className="px-2 py-1.5 text-right">{formatCurrency(totIeps, moneda)}</td>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

