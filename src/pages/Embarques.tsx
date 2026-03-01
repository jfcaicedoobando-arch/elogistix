import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEmbarques, useClientesForSelect } from "@/hooks/useEmbarques";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers";
import type { ModoTransporte, EstadoEmbarque } from "@/data/types";

const ESTADOS: EstadoEmbarque[] = ['Cotización', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Cerrado'];
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
        embarque.descripcion_mercancia.toLowerCase().includes(search.toLowerCase());
      const matchModo = filterModo === "todos" || embarque.modo === filterModo;
      const matchEstado = filterEstado === "todos" || embarque.estado === filterEstado;
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
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por expediente, cliente o mercancía..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
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
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No se encontraron embarques
                  </TableCell>
                </TableRow>
              ) : paginated.map((embarque) => {
                const origen = (embarque.puerto_origen || embarque.aeropuerto_origen || embarque.ciudad_origen || '-').split(',')[0];
                const destino = (embarque.puerto_destino || embarque.aeropuerto_destino || embarque.ciudad_destino || '-').split(',')[0];
                return (
                  <TableRow key={embarque.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${embarque.id}`)}>
                    <TableCell className="font-medium">{embarque.expediente}</TableCell>
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
                      <Badge variant="secondary" className={`text-xs ${getEstadoColor(embarque.estado)}`}>{embarque.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{embarque.operador}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(paginaActual => paginaActual - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(paginaActual => paginaActual + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
