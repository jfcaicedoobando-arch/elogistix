/**
 * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.
 * Filtros avanzados colapsables para ganar espacio vertical.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { copiaContadorOportunidades } from "./oportunidadesContadorCopy";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { useDebounce, useDocumentTitle, usePermissions } from "@/hooks/shared";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { sumarPipelineMxn } from "@/features/crm/domain/pipelineMoneda";
import OportunidadesFiltersSection from "@/features/crm/components/OportunidadesFiltersSection";
import ExportarCsvButton from "@/features/crm/components/ExportarCsvButton";

import OportunidadesDialogs from "@/features/crm/components/OportunidadesDialogs";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import OportunidadesTabsView from "./OportunidadesTabsView";
import { type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { parseOportunidadesUrl, serializeOportunidadesUrl, type OportunidadesUrlState } from "./oportunidadesUrlState";
import { useOportunidades, useEtapasPipeline, type CrmEtapaRow } from "@/features/crm/hooks";
import { useMoverOportunidadEtapa } from "@/features/crm/hooks/useMoverOportunidadEtapa";
import { useVendedoresDisponibles } from "@/features/crm/hooks/useOportunidadesFiltrado";
import { useOportunidadesFiltrosServidor, useExportarOportunidades } from "./useOportunidadesFiltrosServidor";

import { useUsuarios } from "@/features/admin/hooks/usuario";
import { oportunidadesColumns, siguienteActividadColumn, puntajeColumn, activosFiltros } from "./oportunidadesTable";
import { usePuntajes } from "@/features/crm/hooks/useScoringCrm";
import { useProximasActividades } from "@/features/crm/hooks/useProximasActividades";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";

export default function Oportunidades() {
  useDocumentTitle('Oportunidades');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const clienteIdFiltro = searchParams.get("clienteId");
  // Espejo de las policies de `crm_oportunidades`: sin capacidad no se ofrece
  // crear ni mover etapa (antes se mostraban y el guardado moría en RLS).
  const { canCrearOportunidad, canGestionarOportunidad, isAdmin } = usePermissions();
  // v13.823.78 — búsqueda, filtros (vista guardada) y pestaña viven en la URL
  // para que "Volver a Oportunidades" recupere el contexto del KAM.
  const urlState = useMemo(() => parseOportunidadesUrl(searchParams), [searchParams]);
  const search = urlState.search;
  const filtros = urlState.filtros;
  const vista = urlState.vista;
  const aplicarUrlState = useCallback(
    (parcial: Partial<OportunidadesUrlState>) => {
      setSearchParams(
        (prev) => serializeOportunidadesUrl({ ...parseOportunidadesUrl(prev), ...parcial }, prev),
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setSearch = useCallback((v: string) => aplicarUrlState({ search: v }), [aplicarUrlState]);
  const setFiltros = useCallback(
    (v: OportunidadesFiltros) => aplicarUrlState({ filtros: v }),
    [aplicarUrlState],
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  // Etapa de la columna del Kanban desde la que se pulsó "Nueva oportunidad"
  // (null = alta global, sin etapa prefijada).
  const [nuevaEtapaId, setNuevaEtapaId] = useState<string | null>(null);
  const debounced = useDebounce(search, 300);


  const { data: etapas = [] } = useEtapasPipeline();
  const { data: tc } = useExchangeRates();
  const { data: usuarios = [] } = useUsuarios({ enabled: isAdmin });
  const vendedores = useVendedoresDisponibles(usuarios);
  const PAGE_SIZE = 500;
  const filtrosServidor = useOportunidadesFiltrosServidor(debounced, filtros, clienteIdFiltro);
  const { data, isLoading, isPlaceholderData, isError, refetch } = useOportunidades({ ...filtrosServidor, pageSize: PAGE_SIZE });
  // TanStack conserva la página anterior mientras cambia un filtro. Es útil
  // para evitar parpadeos, pero esa página no debe seguir siendo accionable
  // bajo los filtros nuevos (en especial el drag-and-drop del Kanban).
  const actualizandoResultados = Boolean(isPlaceholderData);
  const ops = useMemo(() => data?.data ?? [], [data]);
  const totalServidor = data?.count ?? ops.length;
  const listaTruncada = totalServidor > ops.length;

  const {
    handleMover, proximoPaso, cerrarProximoPaso,
    perdidaPendiente, cerrarPerdida, confirmarPerdida, moviendo,
  } = useMoverOportunidadEtapa({
    etapas: etapas as CrmEtapaRow[],
    oportunidades: ops,
  });


  const idsOps = useMemo(() => ops.map((o) => o.id), [ops]);
  const { data: proximas } = useProximasActividades("oportunidad", idsOps);
  const { data: puntajes } = usePuntajes("oportunidad", idsOps);
  const columnas = useMemo(
    () => [...oportunidadesColumns, puntajeColumn(puntajes ?? new Map()), siguienteActividadColumn(proximas ?? new Map())],
    [proximas, puntajes],
  );

  const { exportando, exportarTodo } = useExportarOportunidades(filtrosServidor);

  const activos = activosFiltros(filtros);
  // UI-15: el pipeline mezcla MXN/USD/EUR; se convierte a pesos antes de sumar.
  const pipelineMxn = useMemo(
    () => sumarPipelineMxn(ops.map((o) => ({ monto: o.monto_estimado, moneda: o.moneda })), tc),
    [ops, tc],
  );

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Oportunidades"
        description="Pipeline de ventas por etapa con vista Kanban y tabla"
        actions={
          <ExportarCsvButton onExport={() => void exportarTodo()} disabled={isLoading || actualizandoResultados || exportando} />
        }
      />

      <CrmSubheader context={actualizandoResultados
        ? "Actualizando oportunidades para los filtros seleccionados…"
        : `${copiaContadorOportunidades(ops.length, totalServidor)}${clienteIdFiltro ? " (filtradas por cliente)" : ""} · total visible ${formatCurrencyCompact(pipelineMxn.mxn, "MXN")}${pipelineMxn.estimado ? " (T/C estimado)" : ""}`} />
      {!actualizandoResultados && listaTruncada && (
        <p className="text-label text-muted-foreground">
          Mostrando las primeras {copiaContadorOportunidades(ops.length, totalServidor)} que cumplen los filtros; la exportación CSV incluye todas.
        </p>
      )}

      <OportunidadesFiltersSection
        search={search}
        onSearchChange={setSearch}
        filtros={filtros}
        onFiltrosChange={setFiltros}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        etapas={etapas as CrmEtapaRow[]}
        vendedores={vendedores}
        activos={activos}
      />

      <OportunidadesTabsView
        vista={vista}
        onVistaChange={(v) => aplicarUrlState({ vista: v })}
        isError={isError}
        isLoading={isLoading || actualizandoResultados}
        refetch={refetch}
        etapas={etapas as CrmEtapaRow[]}
        ops={actualizandoResultados ? [] : ops}
        onMover={handleMover}
        puedeMover={(o) => canGestionarOportunidad(o.vendedor_id)}
        onClickCard={(id) => navigate(`/crm/oportunidades/${id}`)}
        onNuevo={canCrearOportunidad ? (etapaId) => { setNuevaEtapaId(etapaId); setNuevaOpen(true); } : undefined}
        columnas={columnas}
      />

      <OportunidadesDialogs
        proximoPaso={proximoPaso}
        cerrarProximoPaso={cerrarProximoPaso}
        perdidaPendiente={perdidaPendiente}
        cerrarPerdida={cerrarPerdida}
        confirmarPerdida={confirmarPerdida}
        moviendo={moviendo}
      />
      {/* E-11: CTA del estado vacío de las columnas del Kanban. */}
      <NuevaOportunidadDialog
        open={nuevaOpen}
        onOpenChange={(o) => {
          setNuevaOpen(o);
          if (!o) setNuevaEtapaId(null);
        }}
        etapaInicialId={nuevaEtapaId}
        onSaved={() => { setNuevaOpen(false); setNuevaEtapaId(null); void refetch(); }}
      />
    </PageContainer>
  );
}
