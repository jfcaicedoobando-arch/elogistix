import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { usePnlFinanciero } from "@/features/embarques/hooks/usePnlFinanciero";
import type { PnlPorConcepto, PnlPorProveedor } from "@/features/embarques/services/pnlFinanciero";

const fmt = (n: number) => formatCurrency(n ?? 0, "MXN");
const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;

function delta(real: number, presup: number): { abs: number; pct: number } {
  const abs = real - presup;
  const p = presup > 0 ? (abs / presup) * 100 : 0;
  return { abs, pct: p };
}

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "success" | "destructive" | "warning";
}

function KpiCard({ label, value, delta, tone = "default" }: KpiCardProps) {
  const toneClass =
    tone === "success" ? "text-success" :
    tone === "destructive" ? "text-destructive" :
    tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {delta && <div className="text-xs text-muted-foreground">{delta}</div>}
      </CardContent>
    </Card>
  );
}

interface Props {
  embarqueId: string;
}

export function TabPnl({ embarqueId }: Props) {
  const { data, isLoading, error } = usePnlFinanciero(embarqueId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          No se pudo cargar el P&L del embarque. {(error as Error | null)?.message ?? ""}
        </CardContent>
      </Card>
    );
  }

  const ventaReal = data.venta.real_mxn;
  const costoReal = data.costo.real_mxn;
  const utilidadReal = ventaReal - costoReal;
  const margenReal = ventaReal > 0 ? (utilidadReal / ventaReal) * 100 : 0;

  const ventaPresup = data.venta.presupuestada_mxn;
  const costoPresup = data.costo.presupuestado_mxn;
  const utilidadPresup = ventaPresup - costoPresup;
  const margenPresup = ventaPresup > 0 ? (utilidadPresup / ventaPresup) * 100 : 0;

  const dVenta = delta(ventaReal, ventaPresup);
  const dCosto = delta(costoReal, costoPresup);
  const dUtilidad = delta(utilidadReal, utilidadPresup);

  const alertaSobrecosto = costoPresup > 0 && dCosto.pct > 10;
  const alertaVenta = ventaPresup > 0 && ventaReal < ventaPresup;
  const alertaMargen = ventaReal > 0 && margenReal < 15;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Venta real"
          value={fmt(ventaReal)}
          delta={`Presup. ${fmt(ventaPresup)} · Δ ${fmt(dVenta.abs)}`}
          tone={ventaReal >= ventaPresup ? "success" : "warning"}
        />
        <KpiCard
          label="Costo real"
          value={fmt(costoReal)}
          delta={`Presup. ${fmt(costoPresup)} · Δ ${fmt(dCosto.abs)}`}
          tone={alertaSobrecosto ? "destructive" : "default"}
        />
        <KpiCard
          label="Utilidad real"
          value={fmt(utilidadReal)}
          delta={`Presup. ${fmt(utilidadPresup)} · Δ ${fmt(dUtilidad.abs)}`}
          tone={utilidadReal >= utilidadPresup ? "success" : "destructive"}
        />
        <KpiCard
          label="Margen real"
          value={pct(margenReal)}
          delta={`Presup. ${pct(margenPresup)}`}
          tone={margenReal < 15 ? "warning" : "success"}
        />
      </div>

      {/* Alertas */}
      {(alertaSobrecosto || alertaVenta || alertaMargen) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <CardTitle className="text-sm">Alertas financieras</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alertaSobrecosto && (
              <Badge variant="destructive">Sobrecosto {pct(dCosto.pct)}</Badge>
            )}
            {alertaVenta && (
              <Badge variant="outline" className="border-warning text-warning">
                Venta facturada menor a presupuestada
              </Badge>
            )}
            {alertaMargen && (
              <Badge variant="outline" className="border-warning text-warning">
                Margen real {pct(margenReal)} &lt; 15%
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pendientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pendiente de cobro a cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmt(data.venta.pdte_cobro_mxn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pendiente de pago a proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmt(data.costo.pdte_pago_mxn)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla ingresos por concepto */}
      <ComparativaTable
        titulo="Ingresos por concepto (Presupuestado vs. Real)"
        rows={data.por_concepto}
        invertirAlerta={false}
      />

      {/* Tabla costos por concepto */}
      <ComparativaTable
        titulo="Costos por concepto (Presupuestado vs. Real)"
        rows={data.por_concepto_costo}
        invertirAlerta
      />

      {/* Proveedores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose por proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Presupuestado</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right"># Facturas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.por_proveedor.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sin proveedores</TableCell></TableRow>
              )}
              {data.por_proveedor.map((p: PnlPorProveedor) => (
                <TableRow key={`${p.proveedor_id ?? "na"}-${p.proveedor_nombre}`}>
                  <TableCell>{p.proveedor_nombre}</TableCell>
                  <TableCell className="text-right">{fmt(p.presupuestado_mxn)}</TableCell>
                  <TableCell className="text-right">{fmt(p.real_mxn)}</TableCell>
                  <TableCell className="text-right">{p.facturas_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd?.toFixed(4) ?? "—"} · EUR {data.tipo_cambio_eur?.toFixed(4) ?? "—"}
      </p>
    </div>
  );
}

interface ComparativaProps {
  titulo: string;
  rows: PnlPorConcepto[];
  invertirAlerta: boolean;
}

function ComparativaTable({ titulo, rows, invertirAlerta }: ComparativaProps) {
  const totPresup = rows.reduce((a, r) => a + (r.presupuestado_mxn ?? 0), 0);
  const totReal = rows.reduce((a, r) => a + (r.real_mxn ?? 0), 0);
  const totDesv = totReal - totPresup;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Presupuestado</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Δ MXN</TableHead>
              <TableHead className="text-right">Δ %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sin datos</TableCell></TableRow>
            )}
            {rows.map((r, idx) => {
              const d = delta(r.real_mxn, r.presupuestado_mxn);
              const isBad = invertirAlerta ? d.abs > 0 : d.abs < 0;
              const Icon = d.abs >= 0 ? TrendingUp : TrendingDown;
              return (
                <TableRow key={`${r.concepto}-${idx}`} className={idx % 2 ? "bg-muted/30" : ""}>
                  <TableCell className="capitalize">{r.concepto}</TableCell>
                  <TableCell className="text-right">{fmt(r.presupuestado_mxn)}</TableCell>
                  <TableCell className="text-right">{fmt(r.real_mxn)}</TableCell>
                  <TableCell className={`text-right ${isBad ? "text-destructive" : "text-success"}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Icon className="h-3 w-3" />
                      {fmt(d.abs)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right ${isBad ? "text-destructive" : "text-success"}`}>
                    {r.presupuestado_mxn > 0 ? pct(d.pct) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{fmt(totPresup)}</TableCell>
                <TableCell className="text-right">{fmt(totReal)}</TableCell>
                <TableCell className={`text-right ${(invertirAlerta ? totDesv > 0 : totDesv < 0) ? "text-destructive" : "text-success"}`}>
                  {fmt(totDesv)}
                </TableCell>
                <TableCell className="text-right">
                  {totPresup > 0 ? pct((totDesv / totPresup) * 100) : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
