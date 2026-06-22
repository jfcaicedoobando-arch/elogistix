import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/formatters";
import { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { resumirCxpPorPagar, variantDiasParaVencer } from "@/features/bandejas/domain/aggregates";
import { Inbox } from "lucide-react";
import { ComprasTabStrip } from "@/features/cxp/components/ComprasTabStrip";

export default function CxpPorPagar() {
  const { data = [], isLoading } = useCxpPorPagar();
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumirCxpPorPagar(data);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">CxP — Por pagar</h1>
        <p className="text-muted-foreground">
          Facturas de proveedor vigentes con saldo. Programa y registra los pagos.
        </p>
      </div>

      <ComprasTabStrip />


      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas vigentes</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">{formatCurrency(saldoMXN, "MXN")}</div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
              {porMoneda.MXN > 0 && <span>MXN {formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
              {porMoneda.USD > 0 && <span>· USD {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
              {porMoneda.EUR > 0 && <span>· EUR {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
            </div>
            {faltaTipoCambio > 0 && (
              <p className="text-[10px] text-warning mt-0.5">
                {faltaTipoCambio} factura{faltaTipoCambio > 1 ? "s" : ""} sin TC capturado — no incluida{faltaTipoCambio > 1 ? "s" : ""} en homologado.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-destructive">{vencidas}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Folio</TableHead>
                <TableHead>Embarque</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-center">Días</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Cargando...</TableCell></TableRow>
              )}
              {!isLoading && data.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Sin facturas pendientes de pago.
                </TableCell></TableRow>
              )}
              {data.map((row) => {
                const dias = row.dias_para_vencer ?? 0;
                const variant = variantDiasParaVencer(dias);
                return (
                  <TableRow key={row.factura_id} className="hover:bg-muted/50">
                    <TableCell>{row.proveedor_nombre ?? "—"}</TableCell>
                    <TableCell>{row.folio_proveedor ?? "—"}</TableCell>
                    <TableCell>
                      {row.embarque_id ? (
                        <Link to={`/embarques/${row.embarque_id}`} className="text-primary hover:underline">
                          {row.expediente ?? "—"}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={variant}>{dias < 0 ? `${Math.abs(dias)} venc.` : `${dias}d`}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(row.total), row.moneda)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(row.pagado), row.moneda)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(row.saldo), row.moneda)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
