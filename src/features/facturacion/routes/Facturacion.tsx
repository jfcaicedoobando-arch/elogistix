/**
 * Módulo Facturación (v13.92.0 — rediseño).
 *
 * Antes: 6 tabs mezcladas (Por aprobar / Proformas / Emitidas / Cobranza /
 * Pagos a proveedores / Proyección). Era confuso: duplicaba funcionalidad
 * de /cartera, /cxp y reportes.
 *
 * Ahora: dashboard de KPIs siempre visible + 3 tabs claras:
 *   1. Por timbrar    → proformas pendientes de aprobación / timbrado
 *   2. Emitidas       → CFDI vigentes (incluye filtro REP pendientes)
 *   3. Notas de crédito
 *
 * Tabs movidas:
 *   - Cobranza         → /cartera
 *   - Pagos proveedor  → /cxp/por-pagar
 *   - Proyección       → /reportes/cierre-mensual
 *
 * URLs viejas (?tab=cobranza|liquidacion|proyeccion) hacen redirect.
 */
import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Info, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabProformasPendientes } from "@/features/facturacion/components/TabProformasPendientes";
import { TabFacturasEmitidas } from "@/features/facturacion/components/TabFacturasEmitidas";
import { NotasCreditoRecientes } from "@/features/facturacion/components/NotasCreditoRecientes";
import { HuecoFacturacionCard } from "@/features/facturacion/components/HuecoFacturacionCard";
import { DashboardEjecutivoFacturacion } from "@/features/facturacion/components/DashboardEjecutivoFacturacion";
import { FacturacionDialogs } from "@/features/facturacion/components/FacturacionDialogs";
import { DateRangeFilter } from "@/features/facturacion/components/DateRangeFilter";
import { GuiaPrefacturacion } from "@/features/facturacion/components/GuiaPrefacturacion";
import { useFacturacionPageController, useFacturacionDateRange } from "@/features/facturacion/hooks";
import { usePermissions } from "@/hooks/shared";
import { buildFacturaColumns, type Factura } from "./facturacionColumns";

type TabDef = { value: string; label: string; hint: string; badge?: number; tone?: "default" | "warn" };

function TabTriggerInfo({ tab }: { tab: TabDef }) {
  const badgeCls = tab.tone === "warn" ? "text-warning font-semibold" : "text-muted-foreground";
  return (
    <TabsTrigger value={tab.value}>
      <span className="flex items-center gap-1.5">
        {tab.label}
        {typeof tab.badge === "number" && tab.badge > 0 && (
          <span className={`ml-0.5 ${badgeCls}`}>({tab.badge})</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span role="button" tabIndex={0} aria-label={`Info: ${tab.label}`}
              onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}
              className="inline-flex">
              <Info className="h-3 w-3 opacity-60 hover:opacity-100" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs">{tab.hint}</TooltipContent>
        </Tooltip>
      </span>
    </TabsTrigger>
  );
}

// Redirige URLs viejas a sus módulos correctos (Cobranza → /cartera, etc.).
const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  cobranza: "/cartera",
  liquidacion: "/cxp/por-pagar",
  proyeccion: "/reportes/cierre-mensual",
};

export default function Facturacion() {
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const redirectTo = legacyTab ? LEGACY_TAB_REDIRECTS[legacyTab] : undefined;

  const { canEmitirFactura } = usePermissions();
  const [openFacturaManual, setOpenFacturaManual] = useState(false);

  const { range, setRango, limpiar, isInRange, activo } = useFacturacionDateRange();
  const [activeTab, setActiveTab] = useState<string>("pendientes");

  const {
    search, setSearch,
    filterEstado, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, totalPages,
    proformasPendientes,
    loadingFacturas,
    canEdit,
    exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController({ isInRange, activeTab });

  const [pagoFactura, setPagoFactura] = useState<Factura | null>(null);
  const [historialFactura, setHistorialFactura] = useState<Factura | null>(null);
  const [timbrarFactura, setTimbrarFactura] = useState<Factura | null>(null);
  const [cancelarFactura, setCancelarFactura] = useState<Factura | null>(null);

  const facturaColumns = useMemo(
    () => buildFacturaColumns({
      canEdit,
      onRegistrarPago: setPagoFactura,
      onVerPagos: setHistorialFactura,
      onTimbrar: setTimbrarFactura,
      onCancelar: setCancelarFactura,
    }),
    [canEdit],
  );

  const tabs: TabDef[] = [
    { value: "pendientes", label: "1. Por timbrar", hint: "Proformas aprobadas listas para emitir CFDI. Bandeja del día del contador.", badge: proformasPendientes.length, tone: proformasPendientes.length > 0 ? "warn" : "default" },
    { value: "facturas", label: "2. Emitidas", hint: "CFDI vigentes. Incluye Complemento de Pagos (REP) para facturas PPD." },
    { value: "notas", label: "3. Notas de crédito", hint: "Historial de notas de crédito emitidas y su estado." },
  ];

  // Hooks must run before any early return. Redirect after hooks.
  useEffect(() => { /* placeholder to keep hook order consistent */ }, []);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader title="Facturación" description="Emisión de CFDI, complemento de pagos (REP) y notas de crédito" />
          {canEmitirFactura && (
            <Button onClick={() => setOpenFacturaManual(true)} className="shrink-0">
              <FilePlus2 className="h-4 w-4 mr-2" /> Nueva factura manual
            </Button>
          )}
        </div>
        <GuiaPrefacturacion />

        {/* Dashboard de KPIs (siempre visible) */}
        <DashboardEjecutivoFacturacion />

        {/* Alerta global: Hueco de facturación */}
        <HuecoFacturacionCard />

        <Card>
          <CardContent className="p-3">
            <DateRangeFilter range={range} onChange={setRango} onClear={limpiar} activo={activo} />
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {tabs.map((t) => <TabTriggerInfo key={t.value} tab={t} />)}
          </TabsList>

          <TabsContent value="pendientes" className="space-y-4">
            <TabProformasPendientes isInRange={isInRange} />
          </TabsContent>

          <TabsContent value="facturas" className="space-y-4">
            <TabFacturasEmitidas
              search={search} setSearch={setSearch}
              filterEstado={filterEstado} setFilter={setFilter}
              exportarFacturasCsv={exportarFacturasCsv}
              exportarLayoutContable={exportarLayoutContable}
              columns={facturaColumns}
              data={paginatedFacturas}
              isLoading={loadingFacturas}
              page={page} totalPages={totalPages} setPage={setPage}
              pageSize={pageSize} setPageSize={setPageSize}
            />
          </TabsContent>

          <TabsContent value="notas" className="space-y-4">
            <NotasCreditoRecientes />
          </TabsContent>
        </Tabs>

        <FacturacionDialogs
          pagoFactura={pagoFactura} setPagoFactura={setPagoFactura}
          historialFactura={historialFactura} setHistorialFactura={setHistorialFactura}
          timbrarFactura={timbrarFactura} setTimbrarFactura={setTimbrarFactura}
          cancelarFactura={cancelarFactura} setCancelarFactura={setCancelarFactura}
          openFacturaManual={openFacturaManual} setOpenFacturaManual={setOpenFacturaManual}
          canEdit={canEdit}
        />
      </div>
    </TooltipProvider>
  );
}
