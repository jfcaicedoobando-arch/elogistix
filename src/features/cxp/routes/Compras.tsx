/**
 * Dashboard del módulo Compras (`/compras`). Ola B del rediseño (v13.175.0):
 * KPIs, aging resumen, top proveedores por saldo, últimas facturas y accesos
 * rápidos. La navegación entre páginas del módulo vive únicamente en el sidebar
 * (ComprasTabStrip eliminado en Ola A).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Plus, Truck, Inbox, Receipt, Landmark, ArrowRight, LayoutList, ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { useCxpAging } from "@/features/cxp/hooks/useCxpAging";
import { useCxpPendientesAprobacion } from "@/features/cxp/hooks/useCxpPendientesAprobacion";
import { usePermissions } from "@/hooks/shared";
import { formatCurrency, formatCurrencyCompact, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function KpiCard({
  label, value, sub, tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneCls = tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums mt-1", toneCls)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickLink({
  to, icon, title, description, kpi,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  kpi: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{title}</h3>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            <p className="text-sm font-medium tabular-nums mt-2">{kpi}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

interface ProveedorRow { proveedor_id: string; proveedor_nombre: string; saldo_total: number }
function TopProveedoresCard({ rows }: { rows: ProveedorRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 proveedores con saldo</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Sin saldos pendientes.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((p) => (
              <li key={p.proveedor_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="truncate font-medium">{p.proveedor_nombre}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {formatCurrency(p.saldo_total, "MXN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface FacturaRow {
  id: string;
  proveedor_nombre: string | null;
  folio_proveedor: string | null;
  fecha_emision: string | null;
  total: number | string;
  moneda: string | null;
}
function UltimasFacturasCard({ rows }: { rows: FacturaRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas facturas capturadas</CardTitle></CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay facturas capturadas.</p>
        ) : (
          <ul className="divide-y">
            {rows.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.proveedor_nombre ?? "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {f.folio_proveedor ?? "s/folio"} · {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                  </p>
                </div>
                <span className="tabular-nums shrink-0">
                  {formatCurrency(Number(f.total), f.moneda ?? "MXN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function Compras() {
  const { canEdit } = usePermissions();
  const { data: cxp = [], kpis } = useFacturasCxP();
  const { data: porCapturar = [] } = useCxpPorCapturar();
  const { data: aging = [], totales: agingTotales } = useCxpAging();
  const { data: pendientesAprob = 0 } = useCxpPendientesAprobacion();
  const [openNueva, setOpenNueva] = useState(false);

  const metrics = useMemo(() => {
    const conSaldo = cxp.filter((f) => f.saldo > 0.01);
    const vencidas = conSaldo.filter((f) => f.estatus === "Vencida").length;
    const porAprobarMonto = cxp
      .filter((f) => f.estado_aprobacion === "pendiente")
      .reduce((s, f) => s + Number(f.total), 0);
    return {
      facturasConSaldo: conSaldo.length,
      vencidas,
      embarquesPorCapturar: porCapturar.length,
      porAprobarMonto,
    };
  }, [cxp, porCapturar]);

  const topProveedores = useMemo(
    () => [...aging].sort((a, b) => b.saldo_total - a.saldo_total).slice(0, 5),
    [aging],
  );

  const ultimasFacturas = useMemo(
    () =>
      [...cxp]
        .sort((a, b) => (b.fecha_emision ?? "").localeCompare(a.fecha_emision ?? ""))
        .slice(0, 5),
    [cxp],
  );

  const vencidoMas30 = agingTotales.d_31_60 + agingTotales.d_61_90 + agingTotales.mas_90;
  const vencidoTotal = kpis.vencido_mxn + kpis.vencido_usd;

  return (
    <PageContainer>
      <PageHeader
        icon={<ShoppingCart className="h-6 w-6 text-accent" />}
        title="Compras"
        description="Dashboard del módulo: proveedores, facturas recibidas, aprobaciones y pagos."
        actions={canEdit ? (
          <Button onClick={() => setOpenNueva(true)}>
            <Plus className="h-4 w-4 mr-2" /> Capturar factura
          </Button>
        ) : null}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <KpiCard
          label="Embarques por capturar"
          value={metrics.embarquesPorCapturar}
          sub="presupuesto sin factura"
        />
        <KpiCard
          label="Por aprobar"
          value={pendientesAprob}
          sub={pendientesAprob > 0 ? formatCurrencyCompact(metrics.porAprobarMonto, "MXN") : "Sin pendientes"}
          tone={pendientesAprob > 0 ? "warn" : "default"}
        />
        <KpiCard
          label="Facturas con saldo"
          value={metrics.facturasConSaldo}
          sub={`${formatCurrencyCompact(kpis.por_pagar_mxn, "MXN")} · ${formatCurrencyCompact(kpis.por_pagar_usd, "USD")}`}
        />
        <KpiCard
          label="Vencidas"
          value={metrics.vencidas}
          sub={`${formatCurrencyCompact(kpis.vencido_mxn, "MXN")} · ${formatCurrencyCompact(kpis.vencido_usd, "USD")}`}
          tone={vencidoTotal > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Vencido > 30 días"
          value={formatCurrencyCompact(vencidoMas30, "MXN")}
          sub="Cubetas 31-60, 61-90 y >90"
          tone={vencidoMas30 > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Por vencer 7 días"
          value={formatCurrency(kpis.por_vencer_7d_mxn, "MXN")}
          sub={formatCurrencyCompact(kpis.por_vencer_7d_usd, "USD") + " USD"}
          tone={kpis.por_vencer_7d_mxn + kpis.por_vencer_7d_usd > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <QuickLink
          to="/compras/por-aprobar"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Revisar por aprobar"
          description="Facturas a la espera de validación contable."
          kpi={`${pendientesAprob} pendiente${pendientesAprob === 1 ? "" : "s"}`}
        />
        <QuickLink
          to="/compras/aging"
          icon={<LayoutList className="h-5 w-5" />}
          title="Revisar antigüedad"
          description="Cubetas de saldos vencidos por proveedor."
          kpi={vencidoMas30 > 0 ? `${formatCurrencyCompact(vencidoMas30, "MXN")} > 30 días` : "Sin vencidos > 30 días"}
        />
        <QuickLink
          to="/compras/por-pagar"
          icon={<Landmark className="h-5 w-5" />}
          title="Por pagar"
          description="Programa y registra pagos a proveedores."
          kpi={`${metrics.facturasConSaldo} con saldo`}
        />
        <QuickLink
          to="/compras/proveedores"
          icon={<Truck className="h-5 w-5" />}
          title="Proveedores"
          description="Catálogo de proveedores logísticos y de gastos."
          kpi="Ir al catálogo"
        />
        <QuickLink
          to="/compras/por-capturar"
          icon={<Inbox className="h-5 w-5" />}
          title="Por capturar"
          description="Embarques con presupuesto sin factura."
          kpi={`${metrics.embarquesPorCapturar} pendiente${metrics.embarquesPorCapturar === 1 ? "" : "s"}`}
        />
        <QuickLink
          to="/compras/facturas"
          icon={<Receipt className="h-5 w-5" />}
          title="Facturas"
          description="Listado y captura de facturas recibidas."
          kpi={`${cxp.length} factura${cxp.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 proveedores con saldo</CardTitle></CardHeader>
          <CardContent className="p-0">
            {topProveedores.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin saldos pendientes.</p>
            ) : (
              <ul className="divide-y">
                {topProveedores.map((p) => (
                  <li key={p.proveedor_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="truncate font-medium">{p.proveedor_nombre}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">
                      {formatCurrency(p.saldo_total, "MXN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Últimas facturas capturadas</CardTitle></CardHeader>
          <CardContent className="p-0">
            {ultimasFacturas.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Aún no hay facturas capturadas.</p>
            ) : (
              <ul className="divide-y">
                {ultimasFacturas.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.proveedor_nombre ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {f.folio_proveedor ?? "s/folio"} · {f.fecha_emision ? formatDate(f.fecha_emision) : "—"}
                      </p>
                    </div>
                    <span className="tabular-nums shrink-0">
                      {formatCurrency(Number(f.total), f.moneda ?? "MXN")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <DialogNuevaFacturaProveedor open={openNueva} onOpenChange={setOpenNueva} />
    </PageContainer>
  );
}
