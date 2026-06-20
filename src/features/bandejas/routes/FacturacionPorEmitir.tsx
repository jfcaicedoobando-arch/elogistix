import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatters";
import { useFacturacionPorEmitir } from "@/features/bandejas/hooks/useBandejas";
import { resumirFacturacionPorEmitir, DIAS_ATRASO_FACTURACION } from "@/features/bandejas/domain/aggregates";
import { Inbox } from "lucide-react";

export default function FacturacionPorEmitir() {
  const { data = [], isLoading } = useFacturacionPorEmitir();
  const { totalPorFacturar, atrasadas } = resumirFacturacionPorEmitir(data);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Facturación — Por emitir</h1>
        <p className="text-muted-foreground">
          Proformas aprobadas pendientes de timbrar al cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Proformas listas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Importe por facturar</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totalPorFacturar, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Atrasadas (&gt;{DIAS_ATRASO_FACTURACION} días)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-warning">{atrasadas}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proforma</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Embarque</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Días</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Sin proformas pendientes de facturar.
                </TableCell></TableRow>
              )}
              {data.map((row) => (
                <TableRow key={row.proforma_id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/proformas/${row.proforma_id}`} className="text-primary hover:underline">
                      {row.numero_proforma ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{row.cliente_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {row.embarque_id ? (
                      <Link to={`/embarques/${row.embarque_id}`} className="text-primary hover:underline">
                        {row.expediente ?? "—"}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(row.total), "MXN")}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={row.dias_desde_emision > DIAS_ATRASO_FACTURACION ? "destructive" : "secondary"}>
                      {row.dias_desde_emision}d
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
