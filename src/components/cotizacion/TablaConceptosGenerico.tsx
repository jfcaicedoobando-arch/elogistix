import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { calcularSubtotal, calcularIVA } from "@/lib/financialUtils";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";

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
          Conceptos en {moneda}{esMXN ? " + IVA" : ""}
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
                const aplicaIva = esMXN || !!(concepto as any).aplica_iva;
                const lineIva = aplicaIva ? calcularIVA(lineSubtotal, tasaIva) : 0;

                return (
                  <TableRow key={concepto.descripcion ?? indice}>
                    <TableCell>{concepto.descripcion}</TableCell>
                    <TableCell>{concepto.unidad_medida || '—'}</TableCell>
                    <TableCell className="text-right">{concepto.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, moneda)}</TableCell>
                    {esMXN && <TableCell className="text-right">{formatCurrency(lineSubtotal, moneda)}</TableCell>}
                    {esMXN && <TableCell className="text-right">{formatCurrency(lineIva, moneda)}</TableCell>}
                    <TableCell className="text-right font-medium">
                      {formatCurrency(esMXN ? lineSubtotal + lineIva : concepto.total, moneda)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-end mt-3 gap-1">
          {esMXN && subtotal !== undefined && (
            <span className="text-sm">Subtotal MXN: {formatCurrency(subtotal, "MXN")}</span>
          )}
          {esMXN && iva !== undefined && (
            <span className="text-sm">{ivaLabel}: {formatCurrency(iva, "MXN")}</span>
          )}
          <p className="text-lg font-bold">Total {moneda}: {formatCurrency(total, moneda)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
