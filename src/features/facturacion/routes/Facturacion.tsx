/**
 * Módulo Facturación (v13.145.10 — limpieza post-workflow "un clic").
 *
 * Con el flujo nuevo (cliente acepta → conversión de un clic a borrador de
 * factura), el paso interno "aprobar proforma" desapareció. Se eliminaron:
 *   - Tab "Por timbrar" (filtraba por estado_revision='pendiente', flujo viejo).
 *   - Bandeja /facturacion/por-emitir (duplicaba la tab).
 *   - GuiaPrefacturacion (explicaba el flujo antiguo).
 *
 * La visibilidad de "qué está por facturarse" queda en dos lugares:
 *   - HuecoFacturacionCard (embarques con ETD > 5 días sin CFDI).
 *   - /proformas con filtro por estado_cliente.
 *
 * URLs viejas (?tab=cobranza|liquidacion|proyeccion|pendientes) → redirect.
 */
import { useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Info, FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabFacturasEmitidas } from "@/features/facturacion/components/TabFacturasEmitidas";
import { NotasCreditoRecientes } from "@/features/facturacion/components/NotasCreditoRecientes";
import { HuecoFacturacionCard } from "@/features/facturacion/components/HuecoFacturacionCard";
import { DashboardEjecutivoFacturacion } from "@/features/facturacion/components/DashboardEjecutivoFacturacion";
import { FacturacionKpisFiscales } from "@/features/facturacion/components/FacturacionKpisFiscales";
import { FacturacionDialogs } from "@/features/facturacion/components/FacturacionDialogs";
import { DateRangeFilter } from "@/features/facturacion/components/DateRangeFilter";
import { useFacturacionPageController, useFacturacionDateRange } from "@/features/facturacion/hooks";
import { usePermissions } from "@/hooks/shared";
import { buildFacturaColumns, type Factura } from "./facturacionColumns";

type TabDef = { value: string; label: string; hint: string };

function TabTriggerInfo({ tab }: { tab: TabDef }) {
  return (
    <TabsTrigger
      value={tab.value}
      className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none -mb-px"
    >
      <span className="flex items-center gap-1.5">
        {tab.label}
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

// Redirige URLs viejas a sus módulos correctos.
const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  cobranza: "/cartera",
  liquidacion: "/cxp/por-pagar",
  proyeccion: "/reportes/cierre-mensual",
  pendientes: "/proformas?estado=aceptada",
};

export default function Facturacion() {
  const [searchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const redirectTo = legacyTab ? LEGACY_TAB_REDIRECTS[legacyTab] : undefined;

  const { canEmitirFactura } = usePermissions();
  const [openFacturaManual, setOpenFacturaManual] = useState(false);

  const { range, setRango, limpiar, isInRange, activo } = useFacturacionDateRange();
  const [activeTab, setActiveTab] = useState<string>("facturas");

  const {
    search, setSearch,
    filterEstado, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, facturasFiltradas, totalPages,
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
    { value: "facturas", label: "Emitidas", hint: "CFDI vigentes. Incluye Complemento de Pagos (REP) para facturas PPD." },
    { value: "notas", label: "Notas de crédito", hint: "Historial de notas de crédito emitidas y su estado." },
  ];

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
        {/* Dashboard de KPIs (siempre visible) — primer golpe de vista */}
        <DashboardEjecutivoFacturacion />
        <FacturacionKpisFiscales />

        {/* Alerta global: Hueco de facturación (única fuente de "por facturar") */}
        <HuecoFacturacionCard />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b">
            <TabsList className="bg-transparent border-0 p-0 h-auto">
              {tabs.map((t) => <TabTriggerInfo key={t.value} tab={t} />)}
            </TabsList>
            <div className="pb-1">
              <DateRangeFilter range={range} onChange={setRango} onClear={limpiar} activo={activo} />
            </div>
          </div>

          <TabsContent value="facturas" className="space-y-4">
            <TabFacturasEmitidas
              search={search} setSearch={setSearch}
              filterEstado={filterEstado} setFilter={setFilter}
              exportarFacturasCsv={exportarFacturasCsv}
              exportarLayoutContable={exportarLayoutContable}
              columns={facturaColumns}
              data={paginatedFacturas}
              facturasFiltradas={facturasFiltradas}
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
