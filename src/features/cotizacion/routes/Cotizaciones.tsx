import { useMemo, useState } from "react";
import {
  Plus, TrendingUp, CheckCircle, XCircle, BarChart3, AlertTriangle, Archive,
} from "lucide-react";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { KpiCard } from "@/features/operaciones/components/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SearchInput from "@/components/selects/SearchInput";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { useCotizacionesPageController } from "@/features/cotizacion/hooks";
import { buildCotizacionesColumns } from "@/features/cotizacion/components/cotizacionesColumns";
import { CotizacionesMobileFilters } from "@/features/cotizacion/components/CotizacionesMobileFilters";
import { EstadoSelect, ClienteSelect } from "@/features/cotizacion/components/CotizacionesFilterSelects";
import { CotizacionesPageActions } from "@/features/cotizacion/components/CotizacionesPageActions";

export default function Cotizaciones() {
  const c = useCotizacionesPageController();

  const columns = useMemo(
    () =>
      buildCotizacionesColumns({
        canEdit: c.canEdit,
        onEditar: c.irAEditar,
        onEliminar: c.setCotizacionAEliminar,
      }),
    [c.canEdit, c.irAEditar, c.setCotizacionAEliminar],
  );


  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount =
    (c.filterEstado && c.filterEstado !== "todos" ? 1 : 0) +
    (c.filterCliente && c.filterCliente !== "todos" ? 1 : 0) +
    (c.filterSinCostos ? 1 : 0) +
    (c.incluirInactivas ? 1 : 0);
  const clearAllFilters = () => {
    c.setFilter("estado", "todos");
    c.setFilter("cliente", "todos");
    c.setFilter("sinCostos", "no");
    c.setFilter("incluirInactivas", "no");
  };

  const estadoSelect = <EstadoSelect value={c.filterEstado} onChange={(v) => c.setFilter("estado", v)} />;
  const clienteSelect = <ClienteSelect value={c.filterCliente} onChange={(v) => c.setFilter("cliente", v)} clientes={c.clientes} />;
  const sinCostosToggle = (
    <Button
      type="button"
      variant={c.filterSinCostos ? "default" : "outline"}
      size="sm"
      aria-pressed={c.filterSinCostos}
      onClick={() => c.setFilter("sinCostos", c.filterSinCostos ? "no" : "si")}
      className="gap-2"
    >
      <AlertTriangle className="h-4 w-4" />
      Sólo sin costos
    </Button>
  );
  const incluirInactivasToggle = (
    <Button
      type="button"
      variant={c.incluirInactivas ? "default" : "outline"}
      size="sm"
      aria-pressed={c.incluirInactivas}
      onClick={() => c.setFilter("incluirInactivas", c.incluirInactivas ? "no" : "si")}
      className="gap-2"
      title="Por defecto se ocultan las cotizaciones Vencidas y Archivadas"
    >
      <Archive className="h-4 w-4" />
      Incluir vencidas/archivadas
    </Button>
  );

  return (
    // pb-24 md:pb-0: evita que el FAB tape la última fila en mobile.
    <div className="space-y-6 pb-24 md:pb-0">

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard titulo="Total cotizaciones" valor={c.kpis.total} icono={BarChart3} color="blue" />
          <KpiCard titulo="Aceptadas" valor={c.kpis.aceptadas} icono={CheckCircle} color="emerald" />
          <KpiCard titulo="Rechazadas" valor={c.kpis.rechazadas} icono={XCircle} color="red" />
          <KpiCard titulo="Tasa de conversión" valor={`${c.kpis.tasa}%`} icono={TrendingUp} color="violet" />
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <CotizacionesMobileFilters
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            search={c.search}
            onSearchChange={c.setSearch}
            activeFilterCount={activeFilterCount}
            onClearAll={clearAllFilters}
            estadoSelect={estadoSelect}
            clienteSelect={clienteSelect}
          />
          <div className="hidden md:flex md:flex-wrap gap-4">
            <SearchInput
              value={c.search}
              onChange={c.setSearch}
              placeholder="Buscar por folio, cliente o mercancía..."
              className="flex-1 min-w-[200px]"
            />
            {estadoSelect}
            {clienteSelect}
            {sinCostosToggle}
            {incluirInactivasToggle}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <ResponsiveDataTable
            columns={columns}
            data={c.paginated}
            isLoading={c.isLoading}
            emptyMessage="No se encontraron cotizaciones"
            onRowClick={(r) => c.irADetalle(r.id)}
            onRowMouseEnter={(r) => c.prefetchCotizacion(r.id)}
            rowKey={(r) => r.id}
            density="comfortable"
            className="pb-24 sm:pb-0"
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{r.folio}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{toTitleCase(r.cliente_nombre ?? "")}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {r.created_at ? formatDate(r.created_at) : ""}
                    {typeof r.subtotal === "number" ? ` · ${formatCurrency(r.subtotal, r.moneda ?? "USD")}` : ""}
                  </div>
                </div>
                <Badge variant="secondary" className={`text-[10px] whitespace-nowrap ${getEstadoColor(r.estado ?? "")}`}>{r.estado}</Badge>
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
    </div>
  );
}
