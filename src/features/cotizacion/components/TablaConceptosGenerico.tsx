import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { calcularSubtotal, calcularIVA, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { useTasaIVA } from "@/features/catalogos/hooks";
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
  const ivaLabel = `IVA (${tasaIva * 100}%)`;

  if (conceptos.length === 0) return null;

  const esMXN = moneda === "MXN";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Conceptos en {moneda}{esMXN || (iva !== undefined && iva > 0) ? " + IVA" : ""}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">{esMXN ? "P. Unitario" : "Precio Unitario"}</TableHead>
                {esMXN && <TableHead className="text-right">Subtotal</TableHead>}
                {esMXN && <TableHead className="text-right">{ivaLabel}</TableHead>}
                <TableHead className="text-right">Total</TableHead>
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

                return (
                  <TableRow key={concepto.descripcion ?? `concepto-${indice}`}>
                    <TableCell>
                      {concepto.descripcion ?? "—"}
                      {concepto.notas && (
                        <p className="text-xs text-muted-foreground mt-0.5">↳ {concepto.notas}</p>
                      )}
                    </TableCell>
                    <TableCell>{concepto.unidad_medida || '—'}</TableCell>
                    <TableCell className="text-right">{concepto.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, moneda)}</TableCell>
                    {esMXN && <TableCell className="text-right">{formatCurrency(lineSubtotal, moneda)}</TableCell>}
                    {esMXN && <TableCell className="text-right">{formatCurrency(lineIva, moneda)}</TableCell>}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(lineTotal, moneda)}
                    </TableCell>
                  </TableRow>
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
            <span className="text-sm">Subtotal {moneda}: {formatCurrency(subtotal, moneda)}</span>
          )}
          {iva !== undefined && (
            <span className="text-sm">{esMXN ? ivaLabel : "IVA"}: {formatCurrency(iva, moneda)}</span>
          )}
          <p className="text-lg font-bold">Total {moneda}: {formatCurrency(total, moneda)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
