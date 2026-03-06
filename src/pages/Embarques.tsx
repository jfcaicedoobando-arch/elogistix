import { useState, useMemo } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEmbarques } from "@/hooks/useEmbarques";
import { useClientesForSelect } from "@/hooks/useClientes";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import { calcularEstadoEmbarque } from "@/hooks/useEmbarques";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import type { ModoTransporte, EstadoEmbarque } from "@/data/types";

const ESTADOS: string[] = ['Confirmado', 'En Tránsito', 'En Aduana', 'Llegada', 'En Proceso', 'Entregado', 'Cerrado', 'Cancelado'];
const MODOS: ModoTransporte[] = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const PAGE_SIZE = 10;

export default function Embarques() {
  const navigate = useNavigate();
  const { data: embarques = [], isLoading } = useEmbarques();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [page, setPage] = useState(0);
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

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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
            <Select value={filterModo} onValueChange={(valorSeleccionado) => { setFilterModo(valorSeleccionado); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Modo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los modos</SelectItem>
                {MODOS.map(modoTransporte => <SelectItem key={modoTransporte} value={modoTransporte}>{getModoIcon(modoTransporte)} {modoTransporte}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={(valorSeleccionado) => { setFilterEstado(valorSeleccionado); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map(estadoEmbarque => <SelectItem key={estadoEmbarque} value={estadoEmbarque}>{estadoEmbarque}</SelectItem>)}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expediente</TableHead>
                <TableHead>BL Master</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Contenedor</TableHead>
                <TableHead>ETD</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Operador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No se encontraron embarques
                  </TableCell>
                </TableRow>
              ) : paginated.map((embarque) => {
                const origen = (embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-').split(',')[0];
                const destino = (embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-').split(',')[0];
                return (
                  <TableRow key={embarque.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${embarque.id}`)}>
                    <TableCell className="font-medium">{embarque.expediente}</TableCell>
                    <TableCell className="text-xs">{embarque.bl_master || '-'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{embarque.cliente_nombre}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {getModoIcon(embarque.modo)} <span className="text-xs">{embarque.modo}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{origen}</TableCell>
                    <TableCell className="text-xs">{destino}</TableCell>
                    <TableCell className="text-xs">{embarque.tipo_contenedor || '-'}</TableCell>
                    <TableCell className="text-xs">{formatDate(embarque.etd || '')}</TableCell>
                    <TableCell className="text-xs">{formatDate(embarque.eta || '')}</TableCell>
                    <TableCell>
                      {(() => {
                        const estadoMostrado = calcularEstadoEmbarque(embarque.modo, embarque.etd, embarque.eta, embarque.estado);
                        return <Badge variant="secondary" className={`text-xs ${getEstadoColor(estadoMostrado)}`}>{estadoMostrado}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell className="text-xs">{embarque.operador}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
