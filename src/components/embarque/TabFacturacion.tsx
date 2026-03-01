import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { formatDate, getEstadoColor } from "@/lib/helpers";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  estado: string;
}

interface Props {
  facturas: Factura[];
  canEdit: boolean;
}

export function TabFacturacion({ facturas, canEdit }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Facturas del Embarque</CardTitle>
        {canEdit && <Button size="sm"><FileText className="h-4 w-4 mr-1" /> Generar Factura</Button>}
      </CardHeader>
      <CardContent className="p-0">
        {facturas.length > 0 ? (
          <Table>
            <TableHeader><TableRow><TableHead># Factura</TableHead><TableHead>Monto</TableHead><TableHead>Moneda</TableHead><TableHead>Fecha</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
            <TableBody>
              {facturas.map(f => (
                <TableRow key={f.id}><TableCell className="font-medium">{f.numero}</TableCell><TableCell>{formatCurrency(Number(f.total), f.moneda)}</TableCell><TableCell>{f.moneda}</TableCell><TableCell>{formatDate(f.fecha_emision)}</TableCell>
                  <TableCell><Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">No hay facturas generadas para este embarque</div>
        )}
      </CardContent>
    </Card>
  );
}
