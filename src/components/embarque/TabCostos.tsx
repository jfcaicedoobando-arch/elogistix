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

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

export function TabCostos({ conceptosVenta, conceptosCosto, totalVenta, totalCosto, utilidad, margen }: Props) {
  const kpis = [
    { label: 'Total Venta', value: formatCurrency(totalVenta), color: '' },
    { label: 'Total Costo', value: formatCurrency(totalCosto), color: '' },
    { label: 'Utilidad', value: formatCurrency(utilidad), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-success' : 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className={kpiColors[i]}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Cant.</TableHead><TableHead>P. Unitario</TableHead><TableHead>Moneda</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {conceptosVenta.map(concepto => (
                <TableRow key={concepto.id}><TableCell>{concepto.descripcion}</TableCell><TableCell>{concepto.cantidad}</TableCell><TableCell>{formatCurrency(Number(concepto.precio_unitario), concepto.moneda)}</TableCell><TableCell>{concepto.moneda}</TableCell><TableCell className="font-medium">{formatCurrency(Number(concepto.total), concepto.moneda)}</TableCell></TableRow>
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
              {conceptosCosto.map(concepto => (
                <TableRow key={concepto.id}><TableCell>{concepto.proveedor_nombre}</TableCell><TableCell>{concepto.concepto}</TableCell><TableCell className="font-medium">{formatCurrency(Number(concepto.monto), concepto.moneda)}</TableCell><TableCell>{concepto.moneda}</TableCell>
                  <TableCell><Badge className={getEstadoColor(concepto.estado_liquidacion)}>{concepto.estado_liquidacion}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
