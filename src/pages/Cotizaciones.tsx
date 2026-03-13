import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useCotizaciones, useDeleteCotizacion } from "@/hooks/useCotizaciones";
import { getErrorMessage } from "@/lib/errorUtils";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";

const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Vencida', 'Embarcada'];
const DEFAULT_PAGE_SIZE = 20;

type Cotizacion = ReturnType<typeof useCotizaciones>["data"] extends (infer U)[] | undefined ? U : never;

export default function Cotizaciones() {
  const navigate = useNavigate();
  const { data: cotizaciones = [], isLoading } = useCotizaciones();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { canEdit } = usePermissions();
  const deleteCotizacion = useDeleteCotizacion();
  const { toast } = useToast();
  const [cotizacionAEliminar, setCotizacionAEliminar] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return cotizaciones.filter((cotizacion) => {
      const matchSearch = !search ||
        cotizacion.folio.toLowerCase().includes(search.toLowerCase()) ||
        cotizacion.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
        cotizacion.descripcion_mercancia.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || cotizacion.estado === filterEstado;
      const matchCliente = filterCliente === "todos" || cotizacion.cliente_id === filterCliente;
      return matchSearch && matchEstado && matchCliente;
    });
  }, [cotizaciones, search, filterEstado, filterCliente]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const columns: DataTableColumn<Cotizacion>[] = useMemo(() => {
    const cols: DataTableColumn<Cotizacion>[] = [
      { key: "folio", header: "Folio", width: "w-[100px]", className: "font-medium", sortable: true, sortValue: (c) => c.folio, render: (c) => c.folio },
      { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (c) => c.cliente_nombre, render: (c) => c.cliente_nombre },
      { key: "modo", header: "Modo", width: "w-[80px]", className: "text-xs", render: (c) => c.modo },
      { key: "ruta", header: "Origen → Destino", width: "min-w-[160px]", className: "text-xs", render: (c) => `${c.origen || "-"} → ${c.destino || "-"}` },
      { key: "subtotal", header: "Subtotal", width: "w-[110px]", className: "text-right text-xs", headerClassName: "text-right", sortable: true, sortValue: (c) => c.subtotal, render: (c) => formatCurrency(c.subtotal, c.moneda) },
      { key: "estado", header: "Estado", width: "w-[100px]", sortable: true, sortValue: (c) => c.estado, render: (c) => <Badge variant="secondary" className={`text-xs ${getEstadoColor(c.estado)}`}>{c.estado}</Badge> },
      { key: "vigencia", header: "Vigencia", width: "w-[100px]", className: "text-xs", render: (c) => c.fecha_vigencia ? formatDate(c.fecha_vigencia) : "-" },
      { key: "fecha", header: "Fecha", width: "w-[130px]", className: "text-xs", sortable: true, sortValue: (c) => c.created_at, render: (c) => new Date(c.created_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    ];
    if (canEdit) {
      cols.push({
        key: "acciones",
        header: "Acciones",
        headerClassName: "w-[60px]",
        render: (c) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setCotizacionAEliminar(c.id); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      });
    }
    return cols;
  }, [canEdit]);

  const handleDeleteCotizacion = async () => {
    if (!cotizacionAEliminar) return;
    try {
      await deleteCotizacion.mutateAsync(cotizacionAEliminar);
      toast({ title: "Cotización eliminada correctamente" });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar", description: getErrorMessage(err), variant: "destructive" });
    }
    setCotizacionAEliminar(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} cotizaciones encontradas</p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate("/cotizaciones/nueva")}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Cotización
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <SearchInput
              value={search}
              onChange={(valor) => { setSearch(valor); setPage(0); }}
              placeholder="Buscar por folio, cliente o mercancía..."
              className="flex-1 min-w-[200px]"
            />
            <Select value={filterEstado} onValueChange={(valorSeleccionado) => { setFilterEstado(valorSeleccionado); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map(estadoCotizacion => <SelectItem key={estadoCotizacion} value={estadoCotizacion}>{estadoCotizacion}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCliente} onValueChange={(valorSeleccionado) => { setFilterCliente(valorSeleccionado); setPage(0); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {clientes.map(cliente => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nombre.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={paginated}
            isLoading={isLoading}
            emptyMessage="No se encontraron cotizaciones"
            onRowClick={(c) => navigate(`/cotizaciones/${c.id}`)}
            rowKey={(c) => c.id}
          />
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
          />
        </CardContent>
      </Card>

      <DoubleConfirmDeleteDialog
        open={!!cotizacionAEliminar}
        onOpenChange={(open) => { if (!open) setCotizacionAEliminar(null); }}
        entityName="cotización"
        description="Esta acción eliminará la cotización de forma permanente."
        onConfirm={handleDeleteCotizacion}
        isPending={deleteCotizacion.isPending}
      />
    </div>
  );
}
