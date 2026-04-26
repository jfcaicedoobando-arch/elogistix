import { useMemo } from "react";
import {
  Plus, Trash2, MoreHorizontal, Pencil, Download, TrendingUp,
  CheckCircle, XCircle, BarChart3, Copy,
} from "lucide-react";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDate, formatCurrency } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCotizacionesPageController,
  ESTADOS_COTIZACION,
  type CotizacionListItem,
} from "@/hooks/cotizacion/useCotizacionesPageController";

export default function Cotizaciones() {
  const c = useCotizacionesPageController();

  const columns: DataTableColumn<CotizacionListItem>[] = useMemo(() => {
    const cols: DataTableColumn<CotizacionListItem>[] = [
      { key: "folio", header: "Folio", width: "w-[100px]", className: "font-medium", sticky: true, sortable: true, sortValue: (r) => r.folio, render: (r) => r.folio },
      { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (r) => r.cliente_nombre, render: (r) => r.cliente_nombre },
      { key: "modo", header: "Modo", width: "w-[80px]", className: "text-xs", render: (r) => r.modo },
      { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (r) => `${r.origen || "-"} → ${r.destino || "-"}` },
      { key: "subtotal", header: "Subtotal", width: "w-[110px]", className: "text-right text-xs", headerClassName: "text-right", sortable: true, sortValue: (r) => r.subtotal, render: (r) => formatCurrency(r.subtotal, r.moneda) },
      { key: "estado", header: "Estado", width: "w-[100px]", sortable: true, sortValue: (r) => r.estado, render: (r) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(r.estado)}`}>{r.estado}</Badge> },
      { key: "vigencia", header: "Vigencia", width: "w-[100px]", className: "text-xs", render: (r) => r.fecha_vigencia ? formatDate(r.fecha_vigencia) : "-" },
      { key: "fecha", header: "Fecha", width: "w-[130px]", className: "text-xs", sortable: true, sortValue: (r) => r.created_at, render: (r) => new Date(r.created_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    ];
    if (c.canEdit) {
      cols.push({
        key: "acciones",
        header: "",
        headerClassName: "w-[60px]",
        render: (r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); c.irAEditar(r.id); }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); c.duplicar(r.id); }}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); c.setCotizacionAEliminar(r.id); }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }
    return cols;
  }, [c]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">{c.filtered.length} cotizaciones encontradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={c.exportar}>
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          {c.canEdit && (
            <Button onClick={c.irANueva}>
              <Plus className="h-4 w-4 mr-2" /> Nueva Cotización
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard titulo="Total cotizaciones" valor={c.kpis.total} icono={BarChart3} color="blue" />
        <KpiCard titulo="Aceptadas" valor={c.kpis.aceptadas} icono={CheckCircle} color="emerald" />
        <KpiCard titulo="Rechazadas" valor={c.kpis.rechazadas} icono={XCircle} color="red" />
        <KpiCard titulo="Tasa de conversión" valor={`${c.kpis.tasa}%`} icono={TrendingUp} color="violet" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <SearchInput
              value={c.search}
              onChange={c.setSearch}
              placeholder="Buscar por folio, cliente o mercancía..."
              className="flex-1 min-w-[200px]"
            />
            <Select value={c.filterEstado} onValueChange={(v) => c.setFilter("estado", v)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_COTIZACION.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={c.filterCliente} onValueChange={(v) => c.setFilter("cliente", v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {c.clientes.map((cli) => (
                  <SelectItem key={cli.id} value={cli.id}>
                    {cli.nombre.split(' ').slice(0, 3).join(' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          />
          <PaginationControls
            page={c.page}
            totalPages={c.totalPages}
            onPageChange={c.setPage}
            pageSize={c.pageSize}
            onPageSizeChange={(s) => { c.setPageSize(s); c.setPage(0); }}
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
    </div>
  );
}
