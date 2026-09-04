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
import { TooltipProvider } from "@/components/ui/tooltip";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardEjecutivoFacturacion } from "@/features/facturacion/components/DashboardEjecutivoFacturacion";
import { PeriodoFiscalSelector } from "@/features/facturacion/components/PeriodoFiscalSelector";
import { FacturacionDialogs } from "@/features/facturacion/components/FacturacionDialogs";
import { FacturacionBandejasTabs } from "@/features/facturacion/components/bandejas/FacturacionBandejasTabs";
import type { BandejaId } from "@/features/facturacion/components/bandejas/BandejaTabs";
import { useFacturacionPageController, useFacturacionDateRange } from "@/features/facturacion/hooks";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { buildFacturaColumns } from "./facturacionColumns";

const LEGACY_TAB_REDIRECTS: Record<string, string> = {
  cobranza: "/cobranza",
  liquidacion: "/compras/por-pagar",
  proyeccion: "/reportes/cierre-mensual",
  pendientes: "/proformas?estado=aceptada",
};

// Alias hacia atrás: `?bandeja=por-facturar` sigue funcionando y apunta al
// nuevo id `embarques-sin-factura` (mismo contenido, nombre más claro).
const BANDEJA_ALIASES: Record<string, BandejaId> = {
  "por-facturar": "embarques-sin-factura",
};

const BANDEJAS_VALIDAS: BandejaId[] = [
  "embarques-sin-factura", "proformas-listas",
  "por-timbrar", "por-enviar",
  "por-cobrar", "vencidas", "rep-pendientes",
  "emitidas", "notas",
];

export default function Facturacion() {
  useDocumentTitle("Facturación");
  const [searchParams, setSearchParams] = useSearchParams();
  const legacyTab = searchParams.get("tab");
  const redirectTo = legacyTab ? LEGACY_TAB_REDIRECTS[legacyTab] : undefined;

  const { canEmitirFactura } = usePermissions();
  const [openFacturaManual, setOpenFacturaManual] = useState(false);

  const { setRango, limpiar, isInRange, desdeIso, hastaIso } = useFacturacionDateRange();

  const bandejaUrlRaw = searchParams.get("bandeja");
  const bandejaAliased = bandejaUrlRaw && BANDEJA_ALIASES[bandejaUrlRaw]
    ? BANDEJA_ALIASES[bandejaUrlRaw]
    : (bandejaUrlRaw as BandejaId | null);
  const activeBandeja: BandejaId =
    bandejaAliased && BANDEJAS_VALIDAS.includes(bandejaAliased) ? bandejaAliased : "por-timbrar";

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
  // Los filtros de fecha son client-side sobre la página cargada: al cambiarlos
  // hay que volver a la página 0 o el usuario queda en una página fuera de rango.
  const setFechaDesde = (v: string) => { setRango({ desde: v ? parseIso(v) : null }); setPage(0); };
  const setFechaHasta = (v: string) => { setRango({ hasta: v ? parseIso(v) : null }); setPage(0); };

  const {
    search, setSearch,
    filterEstado, filterCliente, setFilter,
    page, setPage, pageSize, setPageSize,
    paginatedFacturas, facturasFiltradas, totalPages, totalCount,
    loadingFacturas,
    errorFacturas,
    refetchFacturas,
    clientesDisponibles,
    exportarFacturasCsv, exportarLayoutContable,
  } = useFacturacionPageController({ isInRange, activeTab: activeBandeja });

  const clearFiltros = () => {
    setSearch(""); setFilter("estado", "todos"); setFilter("cliente", "todos"); limpiar(); setPage(0);
  };

  const facturaColumns = useMemo(() => buildFacturaColumns(), []);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <PageContainer width="wide">
      <TooltipProvider delayDuration={150}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <PageHeader
            title="Facturación"
            description="Panel fiscal: CFDI, complemento de pagos (REP) y cartera de clientes"
          />
          <div className="flex items-center gap-2 shrink-0">
            <PeriodoFiscalSelector
              desdeIso={desdeIso} hastaIso={hastaIso}
              // Igual que los inputs manuales: un preset cambia el universo,
              // así que hay que volver a la página 0 o el usuario cae en vacío.
              onChange={(r) => { setRango(r); setPage(0); }}
            />
            {canEmitirFactura && (
              <Button onClick={() => setOpenFacturaManual(true)}>
                <FilePlus2 className="h-4 w-4 mr-2" /> Nueva factura manual
              </Button>
            )}
          </div>
        </div>

        <DashboardEjecutivoFacturacion />

        {/* v13.425.1 — el guard global se quitó: sólo la bandeja "Emitidas"
            depende de esta query y ya pinta su propio error/reintento.
            Antes, 20 s de carga lenta desmontaban las 8 bandejas. */}
        <FacturacionBandejasTabs
            activeBandeja={activeBandeja}
            setActiveBandeja={setActiveBandeja}
            emitidas={{
              filtros: {
                search, setSearch,
                filterEstado, filterCliente, setFilter,
                fechaDesde: desdeIso ?? "", setFechaDesde,
                fechaHasta: hastaIso ?? "", setFechaHasta,
                clientes: clientesDisponibles,
                onClear: clearFiltros,
              },
              tabla: {
                columns: facturaColumns,
                data: paginatedFacturas,
                facturasFiltradas,
                totalFacturas: totalCount,
                isLoading: loadingFacturas,
                isError: errorFacturas,
                onRetry: refetchFacturas,
                page, totalPages, setPage,
                pageSize, setPageSize,
              },
              acciones: {
                exportarFacturasCsv,
                exportarLayoutContable,
                onCreateNew: () => setOpenFacturaManual(true),
              },
            }}
        />


        <FacturacionDialogs
          openFacturaManual={openFacturaManual}
          setOpenFacturaManual={setOpenFacturaManual}
        />
      </TooltipProvider>
    </PageContainer>
  );
}
