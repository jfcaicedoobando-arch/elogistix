import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/helpers";
import type { ConceptoVentaRow, ConceptoCostoRow } from "@/hooks/useEmbarques";

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

export function TabCostos({ conceptosVenta, conceptosCosto, totalVenta, totalCosto, utilidad, margen }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Venta</p><p className="text-lg font-bold">{formatCurrency(totalVenta)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Costo</p><p className="text-lg font-bold">{formatCurrency(totalCosto)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Utilidad</p><p className={`text-lg font-bold ${utilidad >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(utilidad)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Margen</p><p className={`text-lg font-bold ${margen >= 0 ? 'text-success' : 'text-destructive'}`}>{margen.toFixed(1)}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Cant.</TableHead><TableHead>P. Unitario</TableHead><TableHead>Moneda</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {conceptosVenta.map(c => (
                <TableRow key={c.id}><TableCell>{c.descripcion}</TableCell><TableCell>{c.cantidad}</TableCell><TableCell>{formatCurrency(Number(c.precio_unitario), c.moneda)}</TableCell><TableCell>{c.moneda}</TableCell><TableCell className="font-medium">{formatCurrency(Number(c.total), c.moneda)}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Proveedor</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Liquidación</TableHead></TableRow></TableHeader>
            <TableBody>
              {conceptosCosto.map(c => (
                <TableRow key={c.id}><TableCell>{c.proveedor_nombre}</TableCell><TableCell>{c.concepto}</TableCell><TableCell className="font-medium">{formatCurrency(Number(c.monto), c.moneda)}</TableCell><TableCell>{c.moneda}</TableCell>
                  <TableCell><Badge className={getEstadoColor(c.estado_liquidacion)}>{c.estado_liquidacion}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
