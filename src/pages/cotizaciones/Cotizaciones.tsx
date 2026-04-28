import { useMemo, useState, type ReactNode } from "react";
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
import { formatDate, formatCurrency, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import SearchInput from "@/components/selects/SearchInput";
import PaginationControls from "@/components/shared/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
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
    /**
     * Vigencia + Estado agrupados (v8.99.42 — auditoría visual #13).
     * Estado = badge primario; vigencia = línea secundaria pequeña con tono según urgencia.
     * Reduce ruido visual: antes había 2 badges adyacentes en cada fila ("Enviada" + "Vencida").
     */
    const renderEstadoVigencia = (r: CotizacionListItem) => {
      const estado = r.estado || "—";
      let vigenciaNode: React.ReactNode = null;
      if (r.fecha_vigencia) {
        const fechaStr = formatDate(r.fecha_vigencia);
        const esEnviada = (r.estado || "").toLowerCase() === "enviada";
        if (!esEnviada) {
          vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
        } else {
          const fecha = new Date(r.fecha_vigencia);
          const hoy = new Date();
          const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDias < 0) {
            vigenciaNode = <span className="text-destructive font-medium">Vencida · {fechaStr}</span>;
          } else if (diffDias <= 3) {
            vigenciaNode = (
              <span className="text-warning font-medium">
                {diffDias === 0 ? "Vence hoy" : `Vence en ${diffDias}d`} · {fechaStr}
              </span>
            );
          } else {
            vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
          }
        }
      }
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          <Badge variant="secondary" className={`w-fit text-xs whitespace-nowrap ${getEstadoColor(estado)}`}>{estado}</Badge>
          {vigenciaNode && <span className="text-[10px] whitespace-nowrap">{vigenciaNode}</span>}
        </div>
      );
    };
    const cols: DataTableColumn<CotizacionListItem>[] = [
      { key: "folio", header: "Folio", width: "w-[120px]", className: "font-medium whitespace-nowrap", sticky: true, sortable: true, sortValue: (r) => r.folio, render: (r) => r.folio },
      { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (r) => r.cliente_nombre, render: (r) => {
        const nombre = toTitleCase(r.cliente_nombre);
        return <span title={nombre} className="block truncate">{nombre}</span>;
      } },
      { key: "modo", header: "Modo", width: "w-[80px]", className: "text-xs whitespace-nowrap", render: (r) => r.modo },
      { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs max-w-[200px]", render: (r) => {
        const ruta = `${r.origen || "-"} → ${r.destino || "-"}`;
        return <span title={ruta} className="block truncate whitespace-nowrap">{ruta}</span>;
      } },
      { key: "subtotal", header: "Subtotal", width: "w-[110px]", className: "text-right text-xs whitespace-nowrap", headerClassName: "text-right", sortable: true, sortValue: (r) => r.subtotal, render: (r) => formatCurrency(r.subtotal, r.moneda) },
      { key: "estado_vigencia", header: "Estado", width: "w-[180px]", sortable: true, sortValue: (r) => r.estado, render: renderEstadoVigencia },
      { key: "fecha", header: "Fecha", width: "w-[130px]", className: "text-xs whitespace-nowrap", sortable: true, sortValue: (r) => r.created_at, render: (r) => formatDate(r.created_at, "dd/MM/yyyy HH:mm") },
    ];
    if (c.canEdit) {
      cols.push({
        key: "acciones",
        header: "",
        headerClassName: "w-[60px]",
        render: (r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones de la cotización">
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
      <PageHeader
        title="Cotizaciones"
        description={`${c.filtered.length} cotizaciones encontradas`}
        actions={
          <>
            <Button variant="outline" onClick={c.exportar} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
            {c.canEdit && (
              <Button onClick={c.irANueva} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" /> Nueva Cotización
              </Button>
            )}
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
