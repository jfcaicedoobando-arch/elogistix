/**
 * Dashboard del módulo Compras (`/compras`) — v13.307.22 rediseño ejecutivo.
 *
 * Auditoría previa detectó 14 bloques con 5 duplicados (KPIs vs QuickLinks vs
 * sidebar). Este rediseño consolida:
 *  - 4 KPIs accionables (clickeables, sin duplicar cifras entre sí).
 *  - Gráfica de aging (reemplaza los 3 KPIs de vencimiento).
 *  - Tendencia de captura 14 días (nueva señal ejecutiva).
 *  - Top proveedores con barra proporcional + últimas facturas.
 *  - Eliminada la fila de 6 QuickLinks (duplicaba el sidebar).
 */
import { useMemo, useState } from "react";
import { ShoppingCart, Plus, Inbox, ShieldCheck, Landmark, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { DialogNuevaFacturaProveedor } from "@/features/cxp/components/DialogNuevaFacturaProveedor";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useCxpPorCapturar } from "@/features/bandejas/hooks/useBandejas";
import { useCxpAging } from "@/features/cxp/hooks/useCxpAging";
import { useCxpPendientesAprobacion } from "@/features/cxp/hooks/useCxpPendientesAprobacion";
import { usePermissions } from "@/hooks/shared";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { TopProveedoresCard, UltimasFacturasCard } from "./_sections/ComprasDashboardCards";
import { KpiCard } from "./_sections/ComprasDashboardTiles";
import { ComprasAgingChart } from "./_sections/ComprasAgingChart";
import { ComprasCapturaTrend } from "./_sections/ComprasCapturaTrend";
import { ROUTES } from "@/constants/routes";

export default function Compras() {
  const { canCapturarFacturaProveedor } = usePermissions();
  const { data: cxp = [], kpis, isLoading, isError, refetch } = useFacturasCxP();
  const { data: porCapturar = [] } = useCxpPorCapturar();
  const { rowsFiltradas: aging, totales: agingTotales, monedaActiva: agingMoneda } = useCxpAging();
  const { data: pendientesAprob = 0 } = useCxpPendientesAprobacion();
  const [openNueva, setOpenNueva] = useState(false);

  const metrics = useMemo(() => {
    const conSaldo = cxp.filter((f) => f.saldo > 0.01);
    const porAprobarMonto = cxp
      .filter((f) => f.estado_aprobacion === "pendiente")
      .reduce((s, f) => s + Number(f.total), 0);
    return {
      facturasConSaldo: conSaldo.length,
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

  const vencidoTotal = kpis.vencido_mxn + kpis.vencido_usd;
  const porPagar7d = kpis.por_vencer_7d_mxn + kpis.por_vencer_7d_usd;

  return (
    <PageContainer>
      <PageHeader
        icon={<ShoppingCart className="h-6 w-6 text-accent" />}
        title="Compras"
        description="Facturas de proveedor, aprobaciones y pagos."
        actions={canCapturarFacturaProveedor ? (
          <Button onClick={() => setOpenNueva(true)}>
            <Plus className="h-4 w-4 mr-2" /> Capturar factura
          </Button>
        ) : null}
      />

      <CargaGuard
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorTitle="No se pudo cargar el dashboard de compras"
        errorDescription="Revisa tu conexión y vuelve a intentar."
      >
      {/* Fila 1 · 4 KPIs accionables (cada uno navega a su bandeja) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Por capturar"
          value={metrics.embarquesPorCapturar}
          sub="embarques sin factura"
          to={ROUTES.COMPRAS_POR_CAPTURAR}
          icon={<Inbox className="h-4 w-4" />}
          tone={metrics.embarquesPorCapturar > 0 ? "info" : "default"}
          hint="Embarques con presupuesto operativo cargado pero aún sin factura de proveedor capturada."
        />
        <KpiCard
          label="Por aprobar"
          value={pendientesAprob}
          sub={pendientesAprob > 0 ? formatCurrencyCompact(metrics.porAprobarMonto, "MXN") : "sin pendientes"}
          valueTooltip={pendientesAprob > 0 ? formatCurrency(metrics.porAprobarMonto, "MXN") : undefined}
          to={ROUTES.COMPRAS_POR_APROBAR}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone={pendientesAprob > 0 ? "warn" : "default"}
          hint="Facturas capturadas esperando validación contable antes de pasar a 'Por pagar'."
        />
        <KpiCard
          label="Por pagar"
          value={`${formatCurrencyCompact(kpis.por_pagar_mxn, "MXN")} · ${formatCurrencyCompact(kpis.por_pagar_usd, "USD")}`}
          sub={porPagar7d > 0 ? `${formatCurrencyCompact(porPagar7d, "MXN")} vencen en 7 d` : `${metrics.facturasConSaldo} facturas con saldo`}
          valueTooltip={`${formatCurrency(kpis.por_pagar_mxn, "MXN")} · ${formatCurrency(kpis.por_pagar_usd, "USD")}`}
          to={ROUTES.COMPRAS_POR_PAGAR}
          icon={<Landmark className="h-4 w-4" />}
          tone={porPagar7d > 0 ? "warn" : "default"}
          hint="Saldo aprobado pendiente de pago. El sublabel adelanta lo que vence en 7 días si hay urgencia."
        />
        <KpiCard
          label="Vencido"
          value={vencidoTotal > 0 ? formatCurrencyCompact(vencidoTotal, "MXN") : "$0"}
          sub={vencidoTotal > 0
            ? `${formatCurrencyCompact(kpis.vencido_mxn, "MXN")} · ${formatCurrencyCompact(kpis.vencido_usd, "USD")}`
            : "al corriente"}
          valueTooltip={vencidoTotal > 0 ? formatCurrency(vencidoTotal, "MXN") : undefined}
          to={ROUTES.COMPRAS_AGING}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={vencidoTotal > 0 ? "danger" : "success"}
          hint="Saldo total ya vencido (todas las cubetas de aging combinadas). Click para ver el desglose por proveedor."
        />
      </div>

      {/* Fila 2 · Gráficas ejecutivas: aging (2/3) + tendencia de captura (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <ComprasAgingChart totales={agingTotales} moneda={agingMoneda} />
        </div>
        <div className="lg:col-span-1">
          <ComprasCapturaTrend rows={cxp} />
        </div>
      </div>

      {/* Fila 3 · Contexto de proveedores y capturas recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TopProveedoresCard rows={topProveedores} />
        <UltimasFacturasCard rows={ultimasFacturas} />
      </div>
      </CargaGuard>

      <DialogNuevaFacturaProveedor open={openNueva} onOpenChange={setOpenNueva} />
    </PageContainer>
  );
}
