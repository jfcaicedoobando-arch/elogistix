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
import { useCotizaciones } from "@/hooks/useCotizaciones";
import { useClientesForSelect } from "@/hooks/useEmbarques";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";

const ESTADOS = ['Borrador', 'Enviada', 'Confirmada', 'Rechazada', 'Vencida'];
const PAGE_SIZE = 10;

function getEstadoCotizacionColor(estado: string) {
  switch (estado) {
    case 'Borrador': return 'bg-muted text-muted-foreground';
    case 'Enviada': return 'bg-blue-100 text-blue-800';
    case 'Confirmada': return 'bg-green-100 text-green-800';
    case 'Rechazada': return 'bg-red-100 text-red-800';
    case 'Vencida': return 'bg-orange-100 text-orange-800';
    default: return '';
  }
}

export default function Cotizaciones() {
  const navigate = useNavigate();
  const { data: cotizaciones = [], isLoading } = useCotizaciones();
  const { data: clientes = [] } = useClientesForSelect();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const { canEdit } = usePermissions();

  const filtered = useMemo(() => {
    return cotizaciones.filter((cot) => {
      const matchSearch = !search ||
        cot.folio.toLowerCase().includes(search.toLowerCase()) ||
        cot.cliente_nombre.toLowerCase().includes(search.toLowerCase()) ||
        cot.descripcion_mercancia.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || cot.estado === filterEstado;
      const matchCliente = filterCliente === "todos" || cot.cliente_id === filterCliente;
      return matchSearch && matchEstado && matchCliente;
    });
  }, [cotizaciones, search, filterEstado, filterCliente]);

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
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, cliente o mercancía..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Modo</TableHead>
                <TableHead>Origen → Destino</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron cotizaciones
                  </TableCell>
                </TableRow>
              ) : paginated.map((cot) => (
                <TableRow key={cot.id} className="cursor-pointer" onClick={() => navigate(`/cotizaciones/${cot.id}`)}>
                  <TableCell className="font-medium">{cot.folio}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{cot.cliente_nombre}</TableCell>
                  <TableCell className="text-xs">{cot.modo}</TableCell>
                  <TableCell className="text-xs">{cot.origen || '-'} → {cot.destino || '-'}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(cot.subtotal, cot.moneda)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${getEstadoCotizacionColor(cot.estado)}`}>{cot.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{cot.fecha_vigencia ? formatDate(cot.fecha_vigencia) : '-'}</TableCell>
                  <TableCell className="text-xs">{formatDate(cot.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
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
