import { useMemo, useDeferredValue } from "react";
import { Plus, TrendingUp, CheckCircle, XCircle, BarChart3, AlertTriangle, Archive } from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { KpiCard } from "@/features/operaciones/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useCotizacionesPageController } from "@/features/cotizacion/hooks";
import { buildCotizacionesColumns } from "@/features/cotizacion/components/cotizacionesColumns";
import { EstadoSelect, ClienteSelect } from "@/features/cotizacion/components/CotizacionesFilterSelects";
import { CotizacionesPageActions } from "@/features/cotizacion/components/CotizacionesPageActions";

export default function Cotizaciones() {
  const c = useCotizacionesPageController();

  // Diferimos las filas visibles: al cambiar filtros/paginación, el re-render
  // pesado de la tabla queda en background y no bloquea el input de búsqueda.
  const deferredPaginated = useDeferredValue(c.paginated);

  const columns = useMemo(
    () =>
      buildCotizacionesColumns({
        canEdit: c.canEdit,
        onEliminar: c.setCotizacionAEliminar,
      }),
    [c.canEdit, c.setCotizacionAEliminar],
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
      <PageHeader
        title="Cotizaciones"
        description={`${c.filtered.length} cotizaciones encontradas`}
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
          <KpiCard titulo="Total cotizaciones" valor={c.kpis.total} icono={BarChart3} color="blue" />
          <KpiCard titulo="Aceptadas" valor={c.kpis.aceptadas} icono={CheckCircle} color="emerald" />
          <KpiCard titulo="Rechazadas" valor={c.kpis.rechazadas} icono={XCircle} color="red" />
          <KpiCard titulo="Tasa de conversión" valor={`${c.kpis.tasa}%`} icono={TrendingUp} color="violet" />
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

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={deferredPaginated}
            isLoading={c.isLoading}
            emptyMessage="No se encontraron cotizaciones"
            getRowHref={(r) => `/cotizaciones/${r.id}`}
            onRowMouseEnter={(r) => c.prefetchCotizacion(r.id)}
            rowKey={(r) => r.id}
            density="comfortable"
            className="pb-24 sm:pb-0"
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{r.folio}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{r.cliente_nombre ?? ""}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
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
            }}
          />
        </CardContent>
      </Card>

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
