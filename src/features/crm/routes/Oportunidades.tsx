/**
 * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.
 * Filtros avanzados colapsables para ganar espacio vertical.
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce, useDocumentTitle, usePermissions } from "@/hooks/shared";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { sumarPipelineMxn } from "@/features/crm/domain/pipelineMoneda";
import { LoadingState } from "@/components/shared/states/LoadingState";
import OportunidadKanban from "@/features/crm/components/OportunidadKanban";
import OportunidadesFiltersSection from "@/features/crm/components/OportunidadesFiltersSection";
import ExportarCsvButton from "@/features/crm/components/ExportarCsvButton";

import OportunidadesDialogs from "@/features/crm/components/OportunidadesDialogs";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { useOportunidades, useEtapasPipeline, type CrmEtapaRow } from "@/features/crm/hooks";
import { useMoverOportunidadEtapa } from "@/features/crm/hooks/useMoverOportunidadEtapa";
import { useVendedoresDisponibles } from "@/features/crm/hooks/useOportunidadesFiltrado";
import { useOportunidadesFiltrosServidor, useExportarOportunidades } from "./useOportunidadesFiltrosServidor";

import { useUsuarios } from "@/features/admin/hooks/usuario";
import { oportunidadesColumns, siguienteActividadColumn, activosFiltros } from "./oportunidadesTable";
import { useProximasActividades } from "@/features/crm/hooks/useProximasActividades";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { ErrorState } from "@/components/shared/states/ErrorState";

export default function Oportunidades() {
  useDocumentTitle('Oportunidades');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteIdFiltro = searchParams.get("clienteId");
  // Espejo de las policies de `crm_oportunidades`: sin capacidad no se ofrece
  // crear ni mover etapa (antes se mostraban y el guardado moría en RLS).
  const { canCrearOportunidad, canGestionarOportunidad } = usePermissions();
  const [search, setSearch] = useState("");
  const [filtros, setFiltros] = useState<OportunidadesFiltros>(FILTROS_DEFAULT);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nuevaOpen, setNuevaOpen] = useState(false);
  const debounced = useDebounce(search, 300);

  const { data: etapas = [] } = useEtapasPipeline();
  const { data: tc } = useExchangeRates();
  const { data: usuarios = [] } = useUsuarios();
  const vendedores = useVendedoresDisponibles(usuarios);
  const PAGE_SIZE = 500;
  const filtrosServidor = useOportunidadesFiltrosServidor(debounced, filtros, clienteIdFiltro);
  const { data, isLoading, isError, refetch } = useOportunidades({ ...filtrosServidor, pageSize: PAGE_SIZE });
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


  const { data: proximas } = useProximasActividades(
    "oportunidad",
    useMemo(() => ops.map((o) => o.id), [ops]),
  );
  const columnas = useMemo(
    () => [...oportunidadesColumns, siguienteActividadColumn(proximas ?? new Map())],
    [proximas],
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
          <ExportarCsvButton onExport={() => void exportarTodo()} disabled={isLoading || exportando} />
        }
      />

      <CrmSubheader context={`${ops.length} de ${totalServidor} oportunidades${clienteIdFiltro ? " (filtradas por cliente)" : ""} · pipeline ${formatCurrencyCompact(pipelineMxn.mxn, "MXN")}${pipelineMxn.estimado ? " (T/C estimado)" : ""}`} />
      {listaTruncada && (
        <p className="text-label text-muted-foreground">
          Mostrando las primeras {ops.length} de {totalServidor} oportunidades que cumplen los filtros; la exportación CSV incluye todas.
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

      <Tabs defaultValue="kanban">
        <TabsList variant="vista">
          <TabsTrigger variant="vista" value="kanban">Kanban</TabsTrigger>
          <TabsTrigger variant="vista" value="tabla">Tabla</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          {isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : isLoading ? (
            <LoadingState label="Cargando oportunidades…" />
          ) : (
            <OportunidadKanban
              etapas={etapas as CrmEtapaRow[]}
              oportunidades={ops}
              onMover={handleMover}
              puedeMover={(o) => canGestionarOportunidad(o.vendedor_id)}
              onClickCard={(id) => navigate(`/crm/oportunidades/${id}`)}
              onNuevo={canCrearOportunidad ? () => setNuevaOpen(true) : undefined}
            />
          )}
        </TabsContent>
        <TabsContent value="tabla" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isError ? (
                <ErrorState className="m-4" onRetry={() => void refetch()} />
              ) : (
              <DataTable
                columns={columnas}
                data={ops}
                isLoading={isLoading}
                emptyMessage="No hay oportunidades"
                getRowHref={(o) => `/crm/oportunidades/${o.id}`}
                rowKey={(o) => o.id}
                density={TABLE_DENSITY.listado}
              />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
        onOpenChange={setNuevaOpen}
        onSaved={() => { setNuevaOpen(false); void refetch(); }}
      />
    </PageContainer>
  );
}
