import { useState, useMemo } from "react";
import { Plus, Trash2, MoreHorizontal, Pencil, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useEmbarquesPaginados, calcularEstadoEmbarque, useEliminarEmbarque } from "@/hooks/useEmbarques";
import { getErrorMessage } from "@/lib/errorUtils";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/data/embarqueConstants";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import type { EmbarqueRow } from "@/hooks/useEmbarqueUtils";
import DoubleConfirmDeleteDialog from "@/components/DoubleConfirmDeleteDialog";
import DialogDuplicarEmbarque from "@/components/embarque/DialogDuplicarEmbarque";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DEFAULT_PAGE_SIZE = 20;

function shortName(raw: string) {
  return raw.split(/[,—]/)[0].trim();
}

export default function Embarques() {
  const navigate = useNavigate();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [filterOperador, setFilterOperador] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const eliminarEmbarque = useEliminarEmbarque();
  const registrarActividad = useRegistrarActividad();

  const debouncedSearch = useDebounce(search, 300);

  const { data: resultado, isLoading } = useEmbarquesPaginados({
    search: debouncedSearch,
    filterModo,
    filterEstado,
    filterCliente,
    filterOperador,
    page,
    pageSize,
  });

  const embarques = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;

  const filtered = useMemo(() => {
    if (filterEstado === "todos") return embarques;
    return embarques.filter((e) => {
      const estadoCalculado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      return estadoCalculado === filterEstado;
    });
  }, [embarques, filterEstado]);

  const displayCount = filterEstado !== "todos" ? filtered.length : totalCount;
  const totalPages = filterEstado !== "todos" ? 1 : Math.ceil(totalCount / pageSize);

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<EmbarqueRow | null>(null);
  const [embarqueADuplicar, setEmbarqueADuplicar] = useState<EmbarqueRow | null>(null);

  const operadoresUnicos = useMemo(() => {
    const set = new Set(embarques.map(e => e.operador).filter(Boolean));
    return Array.from(set).sort();
  }, [embarques]);

  const handleEliminar = async () => {
    if (!embarqueAEliminar) return;
    const { id, expediente, cliente_nombre, modo } = embarqueAEliminar;
    try {
      await eliminarEmbarque.mutateAsync(id);
      registrarActividad.mutate({
        accion: 'eliminar', modulo: 'embarques',
        entidad_id: id, entidad_nombre: expediente,
        detalles: { cliente: cliente_nombre, modo },
      });
      toast({ title: "Embarque eliminado", description: `${expediente} fue eliminado permanentemente.` });
    } catch (err: unknown) {
      toast({ title: "Error al eliminar", description: getErrorMessage(err), variant: "destructive" });
    }
    setEmbarqueAEliminar(null);
  };

  const columns: DataTableColumn<EmbarqueRow>[] = useMemo(() => {
    const base: DataTableColumn<EmbarqueRow>[] = [
      { key: "expediente", header: "Expediente", width: "w-[110px]", className: "font-medium", sticky: true, sortable: true, sortValue: (e) => e.expediente, render: (e) => e.expediente },
      { key: "bl", header: "BL Master", width: "w-[120px]", className: "text-xs", render: (e) => e.bl_master || "-" },
      { key: "cliente", header: "Cliente", width: "min-w-[160px]", className: "max-w-[180px] truncate", sortable: true, sortValue: (e) => e.cliente_nombre, render: (e) => e.cliente_nombre },
      {
        key: "modo", header: "Modo", width: "w-[90px]", render: (e) => (
          <span className="flex items-center gap-1">
            {getModoIcon(e.modo)} <span className="text-xs">{e.modo}</span>
          </span>
        ),
      },
      { key: "origen", header: "Origen", width: "w-[120px]", className: "text-xs", render: (e) => shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-") },
      { key: "destino", header: "Destino", width: "w-[120px]", className: "text-xs", render: (e) => shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-") },
      { key: "contenedor", header: "Contenedor", width: "w-[100px]", className: "text-xs", render: (e) => e.tipo_contenedor || "-" },
      { key: "etd", header: "ETD", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.etd || "", render: (e) => formatDate(e.etd || "") },
      { key: "eta", header: "ETA", width: "w-[90px]", className: "text-xs", sortable: true, sortValue: (e) => e.eta || "", render: (e) => formatDate(e.eta || "") },
      {
        key: "estado", header: "Estado", width: "w-[110px]", sortable: true, sortValue: (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado), render: (e) => {
          const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
          return <Badge variant="secondary" className={`text-xs ${getEstadoColor(estado)}`}>{estado}</Badge>;
        },
      },
      { key: "operador", header: "Operador", width: "w-[100px]", className: "text-xs", sortable: true, sortValue: (e) => e.operador, render: (e) => e.operador },
    ];

    if (canEdit) {
      base.push({
        key: "acciones",
        header: "",
        className: "w-10",
        render: (e) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(ev) => ev.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/embarques/${e.id}/editar`)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEmbarqueADuplicar(e)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setEmbarqueAEliminar(e)}>
                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }

    return base;
  }, [canEdit]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Embarques</h1>
          <p className="text-sm text-muted-foreground">{displayCount} embarques encontrados</p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate("/embarques/nuevo")}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <SearchInput
              value={search}
              onChange={(valor) => { setSearch(valor); setPage(0); }}
              placeholder="Buscar por expediente, cliente o mercancía..."
              className="flex-1 min-w-[200px]"
            />
            <Select value={filterModo} onValueChange={(v) => { setFilterModo(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Modo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los modos</SelectItem>
                {MODOS_TRANSPORTE.map(m => <SelectItem key={m} value={m}>{getModoIcon(m)} {m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS_EMBARQUE.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterCliente} onValueChange={(v) => { setFilterCliente(v); setPage(0); }}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los clientes</SelectItem>
                {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre.split(' ').slice(0, 3).join(' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOperador} onValueChange={(v) => { setFilterOperador(v); setPage(0); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Operador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los operadores</SelectItem>
                {operadoresUnicos.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            emptyMessage="No se encontraron embarques"
            onRowClick={(e) => navigate(`/embarques/${e.id}`)}
            rowKey={(e) => e.id}
            rowClassName={() => "group"}
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
        open={!!embarqueAEliminar}
        onOpenChange={(open) => { if (!open) setEmbarqueAEliminar(null); }}
        entityName="embarque"
        description={`El embarque ${embarqueAEliminar?.expediente} será eliminado permanentemente.`}
        finalDescription={`Esta acción no se puede deshacer. Se eliminarán todos los datos, documentos y costos asociados al embarque ${embarqueAEliminar?.expediente}.`}
        onConfirm={handleEliminar}
        isPending={eliminarEmbarque.isPending}
      />
      {embarqueADuplicar && (
        <DialogDuplicarEmbarque
          embarque={embarqueADuplicar}
          open
          onOpenChange={(open) => { if (!open) setEmbarqueADuplicar(null); }}
        />
      )}
    </div>
  );
}
