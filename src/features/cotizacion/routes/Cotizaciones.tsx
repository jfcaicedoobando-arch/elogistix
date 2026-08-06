"use memo";
import { useMemo, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { useDuplicarCotizacion } from "@/features/cotizacion/hooks/useCotizacionVersiones";
import { Plus, TrendingUp, CheckCircle, XCircle, BarChart3, AlertTriangle, Archive } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { KpiCard } from "@/components/shared/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Seo } from "@/components/shared/Seo";
import { pluralizar } from "@/lib/format/pluralizar";

import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { CargaGuard } from "@/components/shared/states/CargaGuard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCotizacionesPageController } from "@/features/cotizacion/hooks";
import { buildCotizacionesColumns } from "@/features/cotizacion/components/cotizacionesColumns";
import { EstadoSelect, ClienteSelect } from "@/features/cotizacion/components/CotizacionesFilterSelects";
import { CotizacionesPageActions } from "@/features/cotizacion/components/CotizacionesPageActions";
import { useTcInicial } from "@/features/catalogos/hooks/useTcInicial";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

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

  const secondaryFilters = (
    <div className="space-y-3">
      <Button
        type="button"
        variant={c.filterSinCostos ? "default" : "outline"}
        size="sm"
        aria-pressed={c.filterSinCostos}
        onClick={() => c.setFilter("sinCostos", c.filterSinCostos ? "no" : "si")}
        className="w-full gap-2"
      >
        <AlertTriangle className="h-4 w-4" />
        Sólo sin costos
      </Button>
      <Button
        type="button"
        variant={c.incluirInactivas ? "default" : "outline"}
        size="sm"
        aria-pressed={c.incluirInactivas}
        onClick={() => c.setFilter("incluirInactivas", c.incluirInactivas ? "no" : "si")}
        className="w-full gap-2"
        title="Por defecto se ocultan las cotizaciones Vencidas y Archivadas"
      >
        <Archive className="h-4 w-4" />
        Incluir vencidas/archivadas
      </Button>
    </div>
  );

  return (
    <PageContainer>
      <Seo
        title="Cotizaciones · Libre Carga"
        description="Consulta, filtra y da seguimiento a tus cotizaciones."
      />
      <PageHeader
        title="Cotizaciones"
        description={`${pluralizar(c.filtered.length, "cotización", { plural: "cotizaciones" })} ${c.filtered.length === 1 ? "encontrada" : "encontradas"}`}

        actions={
          <CotizacionesPageActions
            canEdit={c.canEdit}
            onExportar={c.exportar}
            onNueva={c.irANueva}
          />
        }
      />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">KPIs · Últimos 30 días</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard label="Total cotizaciones" value={c.kpis.total} icon={BarChart3} variant="info" iconVariant="chip" />
          <KpiCard label="Aceptadas" value={c.kpis.aceptadas} icon={CheckCircle} variant="success" iconVariant="chip" />
          <KpiCard label="Rechazadas" value={c.kpis.rechazadas} icon={XCircle} variant="destructive" iconVariant="chip" />
          <KpiCard label="Tasa de conversión" value={`${c.kpis.tasa}%`} icon={TrendingUp} variant="accent" iconVariant="chip" />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <UnifiedFiltersBar
            search={c.search}
            onSearchChange={c.setSearch}
            searchPlaceholder="Buscar por folio, cliente o mercancía…"
            primary={primaryFilters}
            secondary={secondaryFilters}
            chips={c.activeChips}
            activeCount={c.activeCount}
            onClearAll={c.resetAll}
          />
        </CardContent>
      </Card>

      <CargaGuard
        isLoading={c.isLoading}
        isError={c.isError}
        onRetry={() => c.refetch()}
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{r.folio}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{r.cliente_nombre ?? ""}</div>
                  <div className="text-label text-muted-foreground mt-0.5">
                    {r.created_at ? formatDate(r.created_at) : ""}
                    {typeof r.subtotal === "number" ? ` · ${formatCurrency(r.subtotal, r.moneda ?? "USD")}` : ""}
                  </div>
                </div>
                <StatusBadge domain="cotizacion" status={r.estado} />
              </div>
            )}
            pagination={{
              page: c.page,
              totalPages: c.totalPages,
              onPageChange: c.setPage,
              pageSize: c.pageSize,
              onPageSizeChange: (s: number) => { c.setPageSize(s); c.setPage(0); },
              pageSizeOptions: [50, 100, 200, 500],
              pageSizeLabels: { 500: "500" },
              total: c.filtered.length,
            }}
          />
        </CardContent>
      </Card>
      </CargaGuard>

      <DeleteConfirmDialog
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
