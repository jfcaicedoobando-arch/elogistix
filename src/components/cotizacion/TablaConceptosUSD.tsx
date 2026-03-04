import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoVentaCotizacion } from "@/hooks/useCotizaciones";

interface Props {
  conceptos: ConceptoVentaCotizacion[];
  totalUSD: number;
}

export default function TablaConceptosUSD({ conceptos, totalUSD }: Props) {
  if (conceptos.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Conceptos en USD</CardTitle></CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descripción</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio Unitario</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conceptos.map((concepto, indice) => (
                <TableRow key={indice}>
                  <TableCell>{concepto.descripcion}</TableCell>
                  <TableCell>{concepto.unidad_medida || '—'}</TableCell>
                  <TableCell className="text-right">{concepto.cantidad}</TableCell>
                  <TableCell className="text-right">{formatCurrency(concepto.precio_unitario, 'USD')}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(concepto.total, 'USD')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end mt-3">
          <p className="text-lg font-bold">Total USD: {formatCurrency(totalUSD, 'USD')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
