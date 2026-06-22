/**
 * Hub del módulo Compras (`/compras`). Landing con KPIs cruzados, accesos rápidos
 * y la tira de pestañas que viaja por todas las páginas del módulo.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Plus, Truck, Inbox, Receipt, Landmark, ArrowRight, LayoutList, ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { ComprasTabStrip } from "@/features/cxp/components/ComprasTabStrip";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { useCxpAging } from "@/features/cxp/hooks/useCxpAging";
import { useCxpPendientesAprobacion } from "@/features/cxp/hooks/useCxpPendientesAprobacion";
import { usePermissions } from "@/hooks/shared";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
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

export default function Compras() {
  const { canEdit } = usePermissions();
  const { data: cxp = [], kpis } = useFacturasCxP();
  const { data: porCapturar = [] } = useCxpPorCapturar();
  const [openNueva, setOpenNueva] = useState(false);

  const metrics = useMemo(() => {
    const conSaldo = cxp.filter((f) => f.saldo > 0.01);
    const vencidas = conSaldo.filter((f) => f.estatus === "Vencida").length;
    return {
      facturasConSaldo: conSaldo.length,
      vencidas,
      embarquesPorCapturar: porCapturar.length,
    };
  }, [cxp, porCapturar]);

  const vencidoTotal = kpis.vencido_mxn + kpis.vencido_usd; // referencia visual; chip aparte

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<ShoppingCart className="h-6 w-6 text-accent" />}
        title="Compras"
        description="Gestión de proveedores, facturas recibidas y pagos."
        actions={canEdit ? (
          <Button onClick={() => setOpenNueva(true)}>
            <Plus className="h-4 w-4 mr-2" /> Capturar factura
          </Button>
        ) : null}
      />

      <ComprasTabStrip />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard
          label="Embarques por capturar"
          value={metrics.embarquesPorCapturar}
          sub="presupuesto sin factura"
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
          label="Por vencer 7 días"
          value={formatCurrency(kpis.por_vencer_7d_mxn, "MXN")}
          sub={formatCurrencyCompact(kpis.por_vencer_7d_usd, "USD") + " USD"}
          tone={kpis.por_vencer_7d_mxn + kpis.por_vencer_7d_usd > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink
          to="/proveedores"
          icon={<Truck className="h-5 w-5" />}
          title="Proveedores"
          description="Catálogo de proveedores logísticos y de gastos."
          kpi="Ir al catálogo"
        />
        <QuickLink
          to="/cxp/por-capturar"
          icon={<Inbox className="h-5 w-5" />}
          title="Por capturar"
          description="Embarques con presupuesto sin factura."
          kpi={`${metrics.embarquesPorCapturar} pendiente${metrics.embarquesPorCapturar === 1 ? "" : "s"}`}
        />
        <QuickLink
          to="/cxp"
          icon={<Receipt className="h-5 w-5" />}
          title="Facturas"
          description="Listado y captura de facturas recibidas."
          kpi={`${cxp.length} factura${cxp.length === 1 ? "" : "s"}`}
        />
        <QuickLink
          to="/cxp/por-pagar"
          icon={<Landmark className="h-5 w-5" />}
          title="Por pagar"
          description="Programa y registra pagos a proveedores."
          kpi={`${metrics.facturasConSaldo} con saldo`}
        />
      </div>

      <DialogNuevaFacturaProveedor open={openNueva} onOpenChange={setOpenNueva} />
    </div>
  );
}
