import { useMemo, useDeferredValue } from "react";
// YG-03: paginación/filtros server-side vía `useServerPagedList`, encapsulado
// en `useCotizacionesPageController` (mismo primitivo que CRM/bandejas).
import { useNavigate } from "react-router-dom";
import { useDuplicarCotizacion } from "@/features/cotizacion/hooks/useCotizacionVersiones";
import { Plus } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { CotizacionesKpis } from "@/features/cotizacion/components/CotizacionesKpis";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { CotizacionMobileCard } from "@/features/cotizacion/components/CotizacionMobileCard";
import { subtotalesDeFila } from "@/features/cotizacion/components/columnsParts/subtotalesDeFila";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Seo } from "@/components/shared/Seo";
import { pluralizar } from "@/lib/format/pluralizar";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { useCotizacionesPageController } from "@/features/cotizacion/hooks";
import { buildCotizacionesColumns } from "@/features/cotizacion/components/cotizacionesColumns";
import { EstadoSelect, ClienteSelect } from "@/features/cotizacion/components/CotizacionesFilterSelects";
import { CotizacionesPageActions } from "@/features/cotizacion/components/CotizacionesPageActions";
import { useTcInicial } from "@/features/catalogos/hooks/useTcInicial";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { CotizacionesBannerOrigen } from "@/features/cotizacion/components/CotizacionesBannerOrigen";
import { CotizacionesSecondaryFilters } from "@/features/cotizacion/components/CotizacionesSecondaryFilters";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Cotizaciones() {
  const c = useCotizacionesPageController();
  const navigate = useNavigate();
  const duplicar = useDuplicarCotizacion();
  const { data: tcInicial } = useTcInicial();

  // Diferimos las filas visibles: al cambiar filtros/paginación, el re-render
  // pesado de la tabla queda en background y no bloquea el input de búsqueda.
  const deferredPaginated = useDeferredValue(c.paginated);

  const columns = useMemo(
    () =>
      buildCotizacionesColumns({
        canEdit: c.canEdit,
        onEliminar: c.setCotizacionAEliminar,
        onDuplicar: (id: string) =>
          duplicar.mutate(id, {
            onSuccess: (newId) => navigate(`/cotizaciones/${newId}/editar`),
          }),
        usdMxn: tcInicial?.usdMxn,
      }),
    [c.canEdit, c.setCotizacionAEliminar, duplicar, navigate, tcInicial?.usdMxn],
  );

  const primaryFilters = (
    <>
      <EstadoSelect value={c.filterEstado} onChange={(v) => c.setFilter("estado", v)} />
      <ClienteSelect value={c.filterCliente} onChange={(v) => c.setFilter("cliente", v)} clientes={c.clientes} />
    </>
  );

  return (
    <PageContainer width="wide">
      <Seo title="Cotizaciones · Libre Carga" description="Consulta, filtra y da seguimiento a tus cotizaciones." />
      <PageHeader
        title="Cotizaciones"
        description={`${pluralizar(c.total, "cotización", { plural: "cotizaciones" })} ${c.total === 1 ? "encontrada" : "encontradas"}`}


        actions={
          <CotizacionesPageActions
            canEdit={c.canEdit}
            totalFiltrado={c.total}
            onExportar={c.exportar}
            onNueva={c.irANueva}
          />
        }
      />

      <CotizacionesBannerOrigen />
      <CotizacionesKpis {...c.kpis} segmento={c.segmento} />

      {/* Segmento comercial: separa la prospección CRM de la operación con
          clientes activos; los KPIs y la tabla siguen al segmento elegido. */}
      <Tabs
        value={c.segmento}
        onValueChange={(v) => c.setFilter("segmento", v)}
        className="w-full"
      >
        <TabsList aria-label="Segmento de cotizaciones">
          <TabsTrigger value="clientes">
            Clientes ({c.segmentoConteos.clientes})
          </TabsTrigger>
          <TabsTrigger value="prospectos">
            Prospectos ({c.segmentoConteos.prospectos})
          </TabsTrigger>
          <TabsTrigger value="todas">
            Todas ({c.segmentoConteos.todas})
          </TabsTrigger>
        </TabsList>
      </Tabs>


      <Card>
        <CardContent className="p-4">
          <UnifiedFiltersBar
            search={c.search}
            onSearchChange={c.setSearch}
            searchPlaceholder="Buscar por folio, cliente o mercancía…"
            primary={primaryFilters}
            secondary={
              <CotizacionesSecondaryFilters
                soloAceptadasSinEmbarque={c.soloAceptadasSinEmbarque}
                totalAceptadasSinEmbarque={c.totalAceptadasSinEmbarque}
                filterSinCostos={c.filterSinCostos}
                incluirInactivas={c.incluirInactivas}
                setFilter={c.setFilter}
              />
            }
            chips={c.activeChips}
            activeCount={c.activeCount}
            onClearAll={c.resetAll}
          />
        </CardContent>
      </Card>

      <CargaGuard
        isLoading={c.isLoading} isError={c.isError} onRetry={() => c.refetch()}
        errorTitle="No se pudieron cargar las cotizaciones"
        errorDescription="Revisa tu conexión e intenta de nuevo."
      >
      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={deferredPaginated}
            // R-06: mientras el valor diferido va por detrás de la consulta real
            // seguimos mostrando el esqueleto; si no, la tabla parpadeaba a
            // "No se encontraron cotizaciones" con los KPIs ya en 3.
            isLoading={c.isLoading || deferredPaginated !== c.paginated}
            emptyMessage="No se encontraron cotizaciones"
            getRowHref={(r) => `/cotizaciones/${r.id}`}
            onRowMouseEnter={(r) => c.prefetchCotizacion(r.id)}
            rowKey={(r) => r.id}
            density={TABLE_DENSITY.listado}
            className="pb-24 sm:pb-0"
            mobileCard={(r) => (
              <CotizacionMobileCard
                folio={r.folio}
                clienteNombre={(r.es_prospecto ? r.prospecto_empresa : r.cliente_nombre) ?? null}
                createdAt={r.created_at ?? null}
                estado={r.estado}
                subtotales={subtotalesDeFila(r)}
                esProspecto={r.es_prospecto === true}
              />
            )}
            pagination={c.pagination}
            controlledSort={c.controlledSort}
            onSortChange={c.setSort}

          />
        </CardContent>
      </Card>
      </CargaGuard>

      <DoubleConfirmDeleteDialog
        open={!!c.cotizacionAEliminar}
        onOpenChange={(open) => { if (!open) c.setCotizacionAEliminar(null); }}
        entityName="cotización"
        description="Esta acción eliminará la cotización de forma permanente."
        onConfirm={c.confirmarEliminar}
        isPending={c.isDeleting}
      />

      {c.canEdit && (
        <FloatingActionButton
          onClick={c.irANueva}
          icon={<Plus className="h-6 w-6" />}
          label="Nueva cotización"
        />
      )}
    </PageContainer>
  );
}
