import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorCapturar } from "@/features/bandejas/domain/aggregates";
import { Inbox } from "lucide-react";

export default function CxpPorCapturar() {
  const { data = [], isLoading } = useCxpPorCapturar();
  const { totalPresupuestado, facturasCapturadas } = resumirCxpPorCapturar(data);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CxP — Por capturar</h1>
        <p className="text-muted-foreground">
          Embarques con costos presupuestados. Captura las facturas de proveedor y conciliálas contra el embarque.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Embarques pendientes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Costo presupuestado</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totalPresupuestado, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas capturadas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{facturasCapturadas}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Costo presupuestado</TableHead>
                <TableHead className="text-center">Facturas</TableHead>
                <TableHead>Última factura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Sin embarques pendientes de captura.
                </TableCell></TableRow>
              )}
              {data.map((row) => (
                <TableRow key={row.embarque_id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/embarques/${row.embarque_id}`} className="text-primary hover:underline">
                      {row.expediente ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{row.cliente_nombre ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(row.costos_presupuestados), "MXN")}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={row.facturas_capturadas > 0 ? "default" : "secondary"}>
                      {row.facturas_capturadas}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.ultima_factura_fecha ? formatDate(row.ultima_factura_fecha) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
