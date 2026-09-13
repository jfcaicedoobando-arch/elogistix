import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency } from "@/lib/formatters";
import { calcularSubtotal, calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { useTasaIVA } from "@/features/catalogos/hooks";
import { etiquetaTasaIva, tasasEfectivas } from "@/lib/financial/etiquetaTasaIva";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

interface Props {
  moneda: "USD" | "MXN";
  conceptos: ConceptoVentaCotizacion[];
  /** Para MXN: subtotal, iva y total pre-calculados */
  subtotal?: number;
  iva?: number;
  total: number;
}

export default function TablaConceptosGenerico({ moneda, conceptos, subtotal, iva, total }: Props) {
  const tasaIva = useTasaIVA();
  // v13.823.341 — la etiqueta y las columnas de IVA salen de las tasas reales
  // de los renglones, no de la tasa global de la organización. Antes el
  // encabezado decía "MXN + IVA" y la columna "IVA (16%)" incluso cuando todos
  // los conceptos estaban a tasa 0% o exentos, contradiciendo el pie de página.
  const hayIva = tasasEfectivas(conceptos, tasaIva).length > 0 || (iva ?? 0) > 0;
  const ivaLabel = `IVA (${etiquetaTasaIva(conceptos, tasaIva)})`;

  if (conceptos.length === 0) return null;

  const esMXN = moneda === "MXN";
  const mostrarDesgloseIva = esMXN && hayIva;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Conceptos en {moneda}{hayIva ? " + IVA" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <DetailTableHead>Descripción</DetailTableHead>
                <DetailTableHead>Unidad</DetailTableHead>
                <DetailTableHead className="text-right">Cantidad</DetailTableHead>
                <DetailTableHead className="text-right">{esMXN ? "P. Unitario" : "Precio Unitario"}</DetailTableHead>
                {mostrarDesgloseIva && <DetailTableHead className="text-right">Subtotal</DetailTableHead>}
                {mostrarDesgloseIva && <DetailTableHead className="text-right">{ivaLabel}</DetailTableHead>}
                <DetailTableHead className="text-right">Total</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((concepto, indice) => {
                const lineSubtotal = calcularSubtotal(concepto.cantidad, concepto.precio_unitario);
                const tasaFila = resolverTasaConcepto(concepto, tasaIva);
                const lineIva = calcularIVA(lineSubtotal, tasaFila);
                // B-093: conceptos legacy sin `total` — caer al cálculo de
                // línea en lugar de renderizar "USDNaN" / $0.00.
                const totalGuardado = Number(concepto.total);
                const lineTotal = esMXN || !Number.isFinite(totalGuardado)
                  ? lineSubtotal + lineIva
                  : totalGuardado;

                // v13.823.345: la nota del renglón pasa por el filtro de notas
                // internas; si sólo era interna no se renderiza el subrenglón.
                const notaCliente = notasParaCliente(concepto.notas);
                return (
                  // Key estable: `id` cuando existe y, si no, descripción +
                  // índice (descripciones duplicadas generaban keys repetidas).
                  <DetailTableRow key={concepto.id ?? `${concepto.descripcion ?? "concepto"}-${indice}`}>
                    <TableCell>
                      {concepto.descripcion ?? "—"}
                      {notaCliente && (
                        <p className="text-body-sm text-muted-foreground mt-0.5">↳ {notaCliente}</p>
                      )}
                    </TableCell>
                    <TableCell>{concepto.unidad_medida || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{concepto.cantidad}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(concepto.precio_unitario, moneda)}</TableCell>
                    {mostrarDesgloseIva && <TableCell className="text-right tabular-nums">{formatCurrency(lineSubtotal, moneda)}</TableCell>}
                    {mostrarDesgloseIva && <TableCell className="text-right tabular-nums">{formatCurrency(lineIva, moneda)}</TableCell>}
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(lineTotal, moneda)}
                    </TableCell>
                  </DetailTableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-end mt-3 gap-1">
          {/* B-081: el desglose se muestra para cualquier moneda cuyo caller
              pase subtotal/iva (el portal también desglosa el USD con IVA);
              los call-sites internos no pasan desglose USD → no cambian. */}
          {subtotal !== undefined && (
            <span className="text-body">Subtotal {moneda}: {formatCurrency(subtotal, moneda)}</span>
          )}
          {iva !== undefined && hayIva && (
            <span className="text-body">{esMXN ? ivaLabel : "IVA"}: {formatCurrency(iva, moneda)}</span>
          )}
          {iva !== undefined && !hayIva && (
            <span className="text-body-sm text-muted-foreground">Sin IVA: conceptos a tasa 0% o exentos.</span>
          )}
          <p className="text-kpi tabular-nums">Total {moneda}: {formatCurrency(total, moneda)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
