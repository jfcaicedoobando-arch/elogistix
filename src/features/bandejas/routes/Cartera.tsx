import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { resumirCartera } from "@/features/bandejas/domain/aggregates";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";

export default function Cartera() {
  const { data = [], isLoading } = useCarteraPendiente();
  const { totalSaldo, vencidas, vencidoSaldo } = resumirCartera(data);

  return (
    <PageContainer>
      <PageHeader
        title="Cartera"
        description="Facturas emitidas con saldo pendiente. Da seguimiento a cobranza, registra promesas y cobros."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas con saldo</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(totalSaldo, "MXN")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencido ({vencidas})</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{formatCurrency(vencidoSaldo, "MXN")}</CardContent>
        </Card>
      </div>

      {/* Mobile: lista de tarjetas (sm:hidden). Las cifras nunca quedan cortadas. */}
      <Card className="sm:hidden">
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-8 text-center text-muted-foreground">Cargando...</div>
          )}
          {!isLoading && data.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Sin cartera pendiente. ¡Todo cobrado!
            </div>
          )}
          <ul className="divide-y">
            {data.map((row) => (
              <li key={row.factura_id} className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to={`/facturacion/${row.factura_id}`}
                    className="font-semibold text-primary hover:underline truncate"
                  >
                    {row.numero ?? "—"}
                  </Link>
                  <Badge variant={row.dias_vencido > 0 ? "destructive" : "secondary"}>
                    {row.dias_vencido}d
                  </Badge>
                </div>
                <div className="text-sm font-medium truncate">{row.cliente_nombre ?? "—"}</div>
                {row.embarque_id && (
                  <Link
                    to={`/embarques/${row.embarque_id}`}
                    className="text-xs text-primary hover:underline block truncate"
                  >
                    {row.expediente ?? "—"}
                  </Link>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>
                    Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
                  </span>
                  <span className="tabular-nums">
                    Total: {formatCurrency(Number(row.total), row.moneda)}
                  </span>
                </div>
                <div className="text-right text-base font-semibold tabular-nums">
                  {formatCurrency(Number(row.saldo), row.moneda)}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Desktop / tablet: tabla completa. */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead className="min-w-[160px] max-w-[220px]">Cliente</TableHead>
                <TableHead>Embarque</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-center whitespace-nowrap">Días vencido</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Último contacto</TableHead>
              </TableRow>

            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Sin cartera pendiente. ¡Todo cobrado!
                </TableCell></TableRow>
              )}
              {data.map((row) => (
                <TableRow key={row.factura_id} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/facturacion/${row.factura_id}`} className="text-primary hover:underline">
                      {row.numero ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <span className="line-clamp-2 leading-tight" title={row.cliente_nombre ?? undefined}>
                      {row.cliente_nombre ?? "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    {row.embarque_id ? (
                      <Link to={`/embarques/${row.embarque_id}`} className="text-primary hover:underline">
                        {row.expediente ?? "—"}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={row.dias_vencido > 0 ? "destructive" : "secondary"}>
                      {row.dias_vencido}d
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(row.total), row.moneda)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(row.saldo), row.moneda)}</TableCell>
                  <TableCell>{row.ultimo_contacto ? formatDate(row.ultimo_contacto) : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
