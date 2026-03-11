import { useState, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { useEmbarques, calcularEstadoEmbarque, useEliminarEmbarque } from "@/hooks/useEmbarques";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { ESTADOS_EMBARQUE, MODOS_TRANSPORTE } from "@/data/embarqueConstants";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { DataTable, type DataTableColumn } from "@/components/DataTable";

const DEFAULT_PAGE_SIZE = 20;

type Embarque = ReturnType<typeof useEmbarques>["data"] extends (infer U)[] | undefined ? U : never;

function shortName(raw: string) {
  return raw.split(/[,—]/)[0].trim();
}

export default function Embarques() {
  const navigate = useNavigate();
  const { data: embarques = [], isLoading } = useEmbarques();
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

  const [embarqueAEliminar, setEmbarqueAEliminar] = useState<Embarque | null>(null);
  const [paso2, setPaso2] = useState(false);

  const handleEliminar = async () => {
    if (!embarqueAEliminar) return;
    const id = embarqueAEliminar.id;
    const expediente = embarqueAEliminar.expediente;
    const cliente = embarqueAEliminar.cliente_nombre;
    const modo = embarqueAEliminar.modo;

    try {
      await eliminarEmbarque.mutateAsync(id);
      registrarActividad.mutate({
        accion: 'eliminar',
        modulo: 'embarques',
        entidad_id: id,
        entidad_nombre: expediente,
        detalles: { cliente, modo },
      });
      toast({ title: "Embarque eliminado", description: `${expediente} fue eliminado permanentemente.` });
      setEmbarqueAEliminar(null);
      setPaso2(false);
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
      setEmbarqueAEliminar(null);
      setPaso2(false);
    }
  };

  const columns: DataTableColumn<Embarque>[] = useMemo(() => {
    const base: DataTableColumn<Embarque>[] = [
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

  const operadoresUnicos = useMemo(() => {
    const set = new Set(embarques.map(e => e.operador).filter(Boolean));
    return Array.from(set).sort();
  }, [embarques]);

  const filtered = useMemo(() => {
    return embarques.filter((embarque) => {
      const matchSearch = !search || embarque.expediente.toLowerCase().includes(search.toLowerCase()) ||
        embarque.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
        embarque.descripcion_mercancia.toLowerCase().includes(search.toLowerCase()) ||
        (embarque.bl_master || '').toLowerCase().includes(search.toLowerCase());
      const matchModo = filterModo === "todos" || embarque.modo === filterModo;
      const estadoCalculado = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
      const matchEstado = filterEstado === "todos" || estadoCalculado === filterEstado;
      const matchCliente = filterCliente === "todos" || embarque.cliente_id === filterCliente;
      const matchOperador = filterOperador === "todos" || embarque.operador === filterOperador;
      return matchSearch && matchModo && matchEstado && matchCliente && matchOperador;
    });
  }, [embarques, search, filterModo, filterEstado, filterCliente, filterOperador]);

  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Embarques</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} embarques encontrados</p>
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
            data={paginated}
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

      {/* Paso 1 */}
      <AlertDialog open={!!embarqueAEliminar && !paso2} onOpenChange={(v) => { if (!v) setEmbarqueAEliminar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar embarque?</AlertDialogTitle>
            <AlertDialogDescription>
              El embarque <strong>{embarqueAEliminar?.expediente}</strong> será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setPaso2(true)}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2 */}
      <AlertDialog open={paso2} onOpenChange={(v) => { if (!v) { setPaso2(false); setEmbarqueAEliminar(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos, documentos y costos asociados al embarque <strong>{embarqueAEliminar?.expediente}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleEliminar}
              disabled={eliminarEmbarque.isPending}
            >
              {eliminarEmbarque.isPending ? 'Eliminando...' : 'Eliminar definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
