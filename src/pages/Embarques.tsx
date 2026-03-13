import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useEmbarquesPaginados, calcularEstadoEmbarque, useEliminarEmbarque } from "@/hooks/useEmbarques";
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
      { key: "expediente", header: "Expediente", className: "font-medium", render: (e) => e.expediente },
      { key: "bl", header: "BL Master", className: "text-xs", render: (e) => e.bl_master || "-" },
      { key: "cliente", header: "Cliente", className: "max-w-[180px] truncate", render: (e) => e.cliente_nombre },
      {
        key: "modo", header: "Modo", render: (e) => (
          <span className="flex items-center gap-1">
            {getModoIcon(e.modo)} <span className="text-xs">{e.modo}</span>
          </span>
        ),
      },
      { key: "origen", header: "Origen", className: "text-xs", render: (e) => shortName(e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-") },
      { key: "destino", header: "Destino", className: "text-xs", render: (e) => shortName(e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-") },
      { key: "contenedor", header: "Contenedor", className: "text-xs", render: (e) => e.tipo_contenedor || "-" },
      { key: "etd", header: "ETD", className: "text-xs", render: (e) => formatDate(e.etd || "") },
      { key: "eta", header: "ETA", className: "text-xs", render: (e) => formatDate(e.eta || "") },
      {
        key: "estado", header: "Estado", render: (e) => {
          const estado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
          return <Badge variant="secondary" className={`text-xs ${getEstadoColor(estado)}`}>{estado}</Badge>;
        },
      },
      { key: "operador", header: "Operador", className: "text-xs", render: (e) => e.operador },
    ];

    if (canEdit) {
      base.push({
        key: "acciones",
        header: "",
        className: "w-10",
        render: (e) => (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            onClick={(ev) => { ev.stopPropagation(); setEmbarqueAEliminar(e); }}
            title="Eliminar embarque"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
    </div>
  );
}
