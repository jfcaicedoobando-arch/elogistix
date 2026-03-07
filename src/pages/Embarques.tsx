import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useEmbarques, calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
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

const columns: DataTableColumn<Embarque>[] = [
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
  { key: "origen", header: "Origen", className: "text-xs", render: (e) => (e.puerto_origen || e.aeropuerto_origen || e.ciudad_origen || "-").split(",")[0] },
  { key: "destino", header: "Destino", className: "text-xs", render: (e) => (e.puerto_destino || e.aeropuerto_destino || e.ciudad_destino || "-").split(",")[0] },
  { key: "contenedor", header: "Contenedor", className: "text-xs", render: (e) => e.tipo_contenedor || "-" },
  { key: "etd", header: "ETD", className: "text-xs", render: (e) => formatDate(e.etd || "") },
  { key: "eta", header: "ETA", className: "text-xs", render: (e) => formatDate(e.eta || "") },
  {
    key: "estado", header: "Estado", render: (e) => {
      const estado = calcularEstadoEmbarque(e.modo, e.etd, e.eta, e.estado);
      return <Badge variant="secondary" className={`text-xs ${getEstadoColor(estado)}`}>{estado}</Badge>;
    },
  },
  { key: "operador", header: "Operador", className: "text-xs", render: (e) => e.operador },
];

export default function Embarques() {
  const navigate = useNavigate();
  const { data: embarques = [], isLoading } = useEmbarques();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { canEdit } = usePermissions();

  const filtered = useMemo(() => {
    return embarques.filter((embarque) => {
      const matchSearch = !search || embarque.expediente.toLowerCase().includes(search.toLowerCase()) ||
        embarque.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
        embarque.descripcion_mercancia.toLowerCase().includes(search.toLowerCase()) ||
        (embarque.bl_master || '').toLowerCase().includes(search.toLowerCase());
      const matchModo = filterModo === "todos" || embarque.modo === filterModo;
      const estadoCalculado = calcularEstadoEmbarque(embarque.modo, embarque.etd, embarque.eta, embarque.estado);
      const matchEstado = filterEstado === "todos" || estadoCalculado === filterEstado;
      const matchCliente = filterCliente === "todos" || embarque.cliente_id === filterCliente;
      return matchSearch && matchModo && matchEstado && matchCliente;
    });
  }, [embarques, search, filterModo, filterEstado, filterCliente]);

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
    </div>
  );
}
