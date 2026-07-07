/**
 * Cockpit de Facturación (Fase 2 — bandejas de trabajo estilo ERP).
 *
 * En vez de 2 tabs planos, el módulo se organiza en 8 bandejas por acción
 * pendiente (Por facturar, Por timbrar, Por enviar, Por cobrar, Vencidas,
 * REP pendientes, Emitidas, Notas de crédito). Cada bandeja tiene su
 * conteo en un badge y una acción rápida por fila.
 *
 * La bandeja activa se sincroniza con la URL (`?bandeja=por-timbrar`)
 * para permitir enlaces profundos y refresh sin perder contexto.
 *
 * URLs viejas (?tab=cobranza|liquidacion|proyeccion|pendientes) → redirect.
 */
import { useCallback, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabFacturasEmitidas } from "@/features/facturacion/components/TabFacturasEmitidas";
import { NotasCreditoRecientes } from "@/features/facturacion/components/NotasCreditoRecientes";
import { DashboardEjecutivoFacturacion } from "@/features/facturacion/components/DashboardEjecutivoFacturacion";
import { PeriodoFiscalSelector } from "@/features/facturacion/components/PeriodoFiscalSelector";
import { FacturacionDialogs } from "@/features/facturacion/components/FacturacionDialogs";
import { BandejaTabs, type BandejaId } from "@/features/facturacion/components/bandejas/BandejaTabs";
import { BandejaPorFacturar } from "@/features/facturacion/components/bandejas/BandejaPorFacturar";
import { BandejaPorTimbrar } from "@/features/facturacion/components/bandejas/BandejaPorTimbrar";
import { BandejaPorEnviar } from "@/features/facturacion/components/bandejas/BandejaPorEnviar";
import { BandejaPorCobrar } from "@/features/facturacion/components/bandejas/BandejaPorCobrar";
import { BandejaVencidas } from "@/features/facturacion/components/bandejas/BandejaVencidas";
import { BandejaRepPendientes } from "@/features/facturacion/components/bandejas/BandejaRepPendientes";
import { useFacturacionPageController, useFacturacionDateRange } from "@/features/facturacion/hooks";
import { usePermissions } from "@/hooks/shared";
import { buildFacturaColumns } from "./facturacionColumns";

const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  cobranza: "/cartera",
  liquidacion: "/compras/por-pagar",
  proyeccion: "/reportes/cierre-mensual",
  pendientes: "/proformas?estado=aceptada",
};

const BANDEJAS_VALIDAS: BandejaId[] = [
  "por-facturar", "por-timbrar", "por-enviar",
  "por-cobrar", "vencidas", "rep-pendientes",
  "emitidas", "notas",
];

export default function Facturacion() {
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const redirectTo = legacyTab ? LEGACY_TAB_REDIRECTS[legacyTab] : undefined;

  const { canEmitirFactura } = usePermissions();
  const [openFacturaManual, setOpenFacturaManual] = useState(false);

  const { setRango, limpiar, isInRange, desdeIso, hastaIso } = useFacturacionDateRange();

  const bandejaUrl = searchParams.get("bandeja") as BandejaId | null;
  const activeBandeja: BandejaId =
    bandejaUrl && BANDEJAS_VALIDAS.includes(bandejaUrl) ? bandejaUrl : "por-timbrar";

  const setActiveBandeja = useCallback((next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("bandeja", next);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const parseIso = (iso: string): Date | null => {
    if (!iso) return null;
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const setFechaDesde = (v: string) => setRango({ desde: v ? parseIso(v) : null });
  const setFechaHasta = (v: string) => setRango({ hasta: v ? parseIso(v) : null });

  const {
    search, setSearch,
    filterEstado, filterCliente, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, facturasFiltradas, totalPages,
    facturas,
    loadingFacturas,
    clientesDisponibles,
    exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController({ isInRange, activeTab: "facturas" });

  const clearFiltros = () => {
    setSearch(""); setFilter("estado", "todos"); setFilter("cliente", "todos"); limpiar();
  };

  const facturaColumns = useMemo(() => buildFacturaColumns(), []);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <PageContainer>
      <TooltipProvider delayDuration={150}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader
            title="Facturación"
            description="Cockpit fiscal: CFDI, complemento de pagos (REP) y cartera de clientes"
          />
          <div className="flex items-center gap-2 shrink-0">
            <PeriodoFiscalSelector
              desdeIso={desdeIso} hastaIso={hastaIso} onChange={(r) => setRango(r)}
            />
            {canEmitirFactura && (
              <Button onClick={() => setOpenFacturaManual(true)}>
                <FilePlus2 className="h-4 w-4 mr-2" /> Nueva factura manual
              </Button>
            )}
          </div>
        </div>

        <DashboardEjecutivoFacturacion />

        <Tabs value={activeBandeja} onValueChange={setActiveBandeja}>
          <div className="border-b overflow-x-auto">
            <BandejaTabs />
          </div>

          <TabsContent value="por-facturar" className="space-y-4">
            <BandejaPorFacturar />
          </TabsContent>
          <TabsContent value="por-timbrar" className="space-y-4">
            <BandejaPorTimbrar />
          </TabsContent>
          <TabsContent value="por-enviar" className="space-y-4">
            <BandejaPorEnviar />
          </TabsContent>
          <TabsContent value="por-cobrar" className="space-y-4">
            <BandejaPorCobrar />
          </TabsContent>
          <TabsContent value="vencidas" className="space-y-4">
            <BandejaVencidas />
          </TabsContent>
          <TabsContent value="rep-pendientes" className="space-y-4">
            <BandejaRepPendientes />
          </TabsContent>
          <TabsContent value="emitidas" className="space-y-4">
            <TabFacturasEmitidas
              search={search} setSearch={setSearch}
              filterEstado={filterEstado} filterCliente={filterCliente} setFilter={setFilter}
              fechaDesde={desdeIso ?? ""} setFechaDesde={setFechaDesde}
              fechaHasta={hastaIso ?? ""} setFechaHasta={setFechaHasta}
              clientes={clientesDisponibles}
              onClearFiltros={clearFiltros}
              exportarFacturasCsv={exportarFacturasCsv}
              exportarLayoutContable={exportarLayoutContable}
              columns={facturaColumns}
              data={paginatedFacturas}
              facturasFiltradas={facturasFiltradas}
              totalFacturas={facturas.length}
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
          openFacturaManual={openFacturaManual}
          setOpenFacturaManual={setOpenFacturaManual}
        />
      </TooltipProvider>
    </PageContainer>
  );
}
