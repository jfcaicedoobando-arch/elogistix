import { useMemo, useState } from "react";
import {
  Plus, MoreHorizontal, Download, TrendingUp,
  CheckCircle, XCircle, BarChart3, Filter, X,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SearchInput from "@/components/selects/SearchInput";
import { DataTable } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCotizacionesPageController,
  ESTADOS_COTIZACION,
} from "@/hooks/cotizacion/useCotizacionesPageController";
import { buildCotizacionesColumns } from "@/components/cotizacion/cotizacionesColumns";

export default function Cotizaciones() {
  const c = useCotizacionesPageController();

  const columns = useMemo(
    () =>
      buildCotizacionesColumns({
        canEdit: c.canEdit,
        onEditar: c.irAEditar,
        onDuplicar: c.duplicar,
        onEliminar: c.setCotizacionAEliminar,
      }),
    [c.canEdit, c.irAEditar, c.duplicar, c.setCotizacionAEliminar],
  );

  // Filtros mobile en Sheet + FAB para acción primaria.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount =
    (c.filterEstado && c.filterEstado !== "todos" ? 1 : 0) +
    (c.filterCliente && c.filterCliente !== "todos" ? 1 : 0);
  const clearAllFilters = () => {
    c.setFilter("estado", "todos");
    c.setFilter("cliente", "todos");
  };

  const EstadoSelect = (
    <Select value={c.filterEstado} onValueChange={(v) => c.setFilter("estado", v)}>
      <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los estados</SelectItem>
        {ESTADOS_COTIZACION.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const ClienteSelect = (
    <Select value={c.filterCliente} onValueChange={(v) => c.setFilter("cliente", v)}>
      <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="todos">Todos los clientes</SelectItem>
        {c.clientes.map((cli) => (
          <SelectItem key={cli.id} value={cli.id}>
            {cli.nombre.split(" ").slice(0, 3).join(" ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        description={`${c.filtered.length} cotizaciones encontradas`}
        actions={
          <>
            <Button variant="outline" onClick={c.exportar} className="hidden sm:inline-flex">
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            {c.canEdit && (
              <Button onClick={c.irANueva} className="hidden sm:inline-flex">
                <Plus className="h-4 w-4 mr-2" /> Nueva Cotización
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="sm:hidden" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={c.exportar}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Total cotizaciones" valor={c.kpis.total} icono={BarChart3} color="blue" />
        <KpiCard titulo="Aceptadas" valor={c.kpis.aceptadas} icono={CheckCircle} color="emerald" />
        <KpiCard titulo="Rechazadas" valor={c.kpis.rechazadas} icono={XCircle} color="red" />
        <KpiCard titulo="Tasa de conversión" valor={`${c.kpis.tasa}%`} icono={TrendingUp} color="violet" />
      </div>

      <Card>
        <CardContent className="p-4">
          {/* Mobile: search + Filtros (N) → Sheet */}
          <div className="flex gap-2 md:hidden">
            <SearchInput
              value={c.search}
              onChange={c.setSearch}
              placeholder="Buscar..."
              className="flex-1 min-w-0"
            />
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="shrink-0 gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Filtros</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[11px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full max-w-sm flex flex-col gap-0 p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle>Filtros de cotizaciones</SheetTitle>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Estado</label>
                    {EstadoSelect}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                    {ClienteSelect}
                  </div>
                </div>
                <SheetFooter className="p-4 border-t flex-row gap-2 sm:flex-row sm:justify-between">
                  <Button variant="ghost" onClick={clearAllFilters} disabled={activeFilterCount === 0} className="gap-2">
                    <X className="h-4 w-4" /> Limpiar
                  </Button>
                  <Button onClick={() => setFiltersOpen(false)}>Aplicar</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop md+: layout inline */}
          <div className="hidden md:flex md:flex-wrap gap-4">
            <SearchInput
              value={c.search}
              onChange={c.setSearch}
              placeholder="Buscar por folio, cliente o mercancía..."
              className="flex-1 min-w-[200px]"
            />
            {EstadoSelect}
            {ClienteSelect}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={c.paginated}
            isLoading={c.isLoading}
            emptyMessage="No se encontraron cotizaciones"
            onRowClick={(r) => c.irADetalle(r.id)}
            onRowMouseEnter={(r) => c.prefetchCotizacion(r.id)}
            rowKey={(r) => r.id}
            density="comfortable"
            pagination={{
              page: c.page,
              totalPages: c.totalPages,
              onPageChange: c.setPage,
              pageSize: c.pageSize,
              onPageSizeChange: (s) => { c.setPageSize(s); c.setPage(0); },
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
