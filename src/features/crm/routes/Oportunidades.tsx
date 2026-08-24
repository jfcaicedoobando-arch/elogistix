/**
 * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.
 * Filtros avanzados colapsables para ganar espacio vertical.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { DataTable } from "@/components/shared/DataTable";
import { useDebounce, useDocumentTitle } from "@/hooks/shared";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { sumarPipelineMxn } from "@/features/crm/domain/pipelineMoneda";
import { LoadingState } from "@/components/shared/states/LoadingState";
import OportunidadKanban from "@/features/crm/components/OportunidadKanban";
import OportunidadesFiltersSection from "@/features/crm/components/OportunidadesFiltersSection";
import ExportarCsvButton from "@/features/crm/components/ExportarCsvButton";
import { exportarOportunidadesCsv } from "@/features/crm/services/crmCsvExport";

import OportunidadesDialogs from "@/features/crm/components/OportunidadesDialogs";
import NuevaOportunidadDialog from "@/features/crm/components/NuevaOportunidadDialog";
import { FILTROS_DEFAULT, type OportunidadesFiltros } from "@/features/crm/components/oportunidadesFiltersTypes";
import { useOportunidades, useEtapasPipeline, type CrmEtapaRow } from "@/features/crm/hooks";
import { useMoverOportunidadEtapa } from "@/features/crm/hooks/useMoverOportunidadEtapa";
import { useOportunidadesFiltradas, useVendedoresDisponibles } from "@/features/crm/hooks/useOportunidadesFiltrado";

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
  const { data, isLoading, isError, refetch } = useOportunidades({ search: debounced, pageSize: PAGE_SIZE });
  const opsRaw = useMemo(() => data?.data ?? [], [data]);
  // EC-17: la página dura de 500 no avisaba cuando el servidor tenía más.
  const totalServidor = data?.count ?? opsRaw.length;
  const listaTruncada = totalServidor > opsRaw.length;

  const ops = useOportunidadesFiltradas(opsRaw, filtros);

  const {
    handleMover, proximoPaso, cerrarProximoPaso,
    perdidaPendiente, cerrarPerdida, confirmarPerdida, moviendo,
  } = useMoverOportunidadEtapa({
    etapas: etapas as CrmEtapaRow[],
    oportunidades: opsRaw,
  });


  const { data: proximas } = useProximasActividades(
    "oportunidad",
    useMemo(() => ops.map((o) => o.id), [ops]),
  );
  const columnas = useMemo(
    () => [...oportunidadesColumns, siguienteActividadColumn(proximas ?? new Map())],
    [proximas],
  );

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
          <ExportarCsvButton onExport={() => exportarOportunidadesCsv(ops)} disabled={isLoading} />
        }
      />

      <CrmSubheader context={`${ops.length} de ${opsRaw.length} oportunidades · pipeline ${formatCurrencyCompact(pipelineMxn.mxn, "MXN")}${pipelineMxn.estimado ? " (T/C estimado)" : ""}`} />
      {listaTruncada && (
        <p className="text-label text-warning">
          Mostrando las primeras {opsRaw.length} de {totalServidor} oportunidades; refina tu búsqueda o aplica filtros para ver el resto.
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
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="tabla">Tabla</TabsTrigger>
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
              onClickCard={(id) => navigate(`/crm/oportunidades/${id}`)}
              onNuevo={() => setNuevaOpen(true)}
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
