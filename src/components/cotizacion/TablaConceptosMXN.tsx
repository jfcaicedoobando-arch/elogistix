import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";

interface Props {
  conceptos: ConceptoVentaCotizacion[];
  subtotalMXN: number;
  ivaMXN: number;
  totalMXN: number;
}

export default function TablaConceptosMXN({ conceptos, subtotalMXN, ivaMXN, totalMXN }: Props) {
  if (conceptos.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Conceptos en MXN + IVA</CardTitle></CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">P. Unitario</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IVA (16%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((concepto, indice) => {
                const subtotal = concepto.cantidad * concepto.precio_unitario;
                const iva = subtotal * 0.16;
                return (
                  <TableRow key={indice}>
                    <TableCell>{concepto.descripcion}</TableCell>
                    <TableCell>{concepto.unidad_medida || '—'}</TableCell>
                    <TableCell className="text-right">{concepto.cantidad}</TableCell>
                    <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, 'MXN')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(subtotal, 'MXN')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(iva, 'MXN')}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(subtotal + iva, 'MXN')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col items-end mt-3 gap-1">
          <span className="text-sm">Subtotal MXN: {formatCurrency(subtotalMXN, 'MXN')}</span>
          <span className="text-sm">IVA (16%): {formatCurrency(ivaMXN, 'MXN')}</span>
          <p className="text-lg font-bold">Total MXN: {formatCurrency(totalMXN, 'MXN')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
