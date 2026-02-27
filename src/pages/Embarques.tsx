import { useState, useMemo } from "react";
import { Plus, Search, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { embarques, clientes, formatDate, getEstadoColor, getModoIcon } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import type { ModoTransporte, EstadoEmbarque } from "@/data/types";

const ESTADOS: EstadoEmbarque[] = ['Cotización', 'Confirmado', 'En Tránsito', 'Llegada', 'En Proceso', 'Cerrado'];
const MODOS: ModoTransporte[] = ['Marítimo', 'Aéreo', 'Terrestre', 'Multimodal'];
const PAGE_SIZE = 10;

export default function Embarques() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return embarques.filter((e) => {
      const matchSearch = !search || e.expediente.toLowerCase().includes(search.toLowerCase()) ||
        e.clienteNombre.toLowerCase().includes(search.toLowerCase()) ||
        e.descripcionMercancia.toLowerCase().includes(search.toLowerCase());
      const matchModo = filterModo === "todos" || e.modo === filterModo;
      const matchEstado = filterEstado === "todos" || e.estado === filterEstado;
      const matchCliente = filterCliente === "todos" || e.clienteId === filterCliente;
      return matchSearch && matchModo && matchEstado && matchCliente;
    });
  }, [search, filterModo, filterEstado, filterCliente]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Embarques</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} embarques encontrados</p>
        </div>
        <Button onClick={() => navigate("/embarques/nuevo")}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo Embarque
        </Button>
      </div>

      {/* Filters */}
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
            <Select value={filterModo} onValueChange={(v) => { setFilterModo(v); setPage(0); }}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Modo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los modos</SelectItem>
                {MODOS.map(m => <SelectItem key={m} value={m}>{getModoIcon(m)} {m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEstado} onValueChange={(v) => { setFilterEstado(v); setPage(0); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
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

      {/* Table */}
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
              {paginated.map((e) => {
                const origen = (e.puertoOrigen || e.aeropuertoOrigen || e.ciudadOrigen || '-').split(',')[0];
                const destino = (e.puertoDestino || e.aeropuertoDestino || e.ciudadDestino || '-').split(',')[0];
                return (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => navigate(`/embarques/${e.id}`)}>
                    <TableCell className="font-medium">{e.expediente}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{e.clienteNombre}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {getModoIcon(e.modo)} <span className="text-xs">{e.modo}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{origen}</TableCell>
                    <TableCell className="text-xs">{destino}</TableCell>
                    <TableCell className="text-xs">{e.tipoContenedor || '-'}</TableCell>
                    <TableCell className="text-xs">{formatDate(e.etd)}</TableCell>
                    <TableCell className="text-xs">{formatDate(e.eta)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${getEstadoColor(e.estado)}`}>{e.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.operador}</TableCell>
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
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
