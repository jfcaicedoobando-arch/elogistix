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
import { useCotizaciones } from "@/hooks/useCotizaciones";
import { useClientesForSelect } from "@/hooks/useEmbarques";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { formatCurrency } from "@/lib/formatters";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

const ESTADOS = ['Borrador', 'Enviada', 'Aceptada', 'Confirmada', 'Rechazada', 'Vencida'];
const PAGE_SIZE = 10;

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
              ) : paginated.map((cotizacion) => (
                <TableRow key={cotizacion.id} className="cursor-pointer" onClick={() => navigate(`/cotizaciones/${cotizacion.id}`)}>
                  <TableCell className="font-medium">{cotizacion.folio}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{cotizacion.cliente_nombre}</TableCell>
                  <TableCell className="text-xs">{cotizacion.modo}</TableCell>
                  <TableCell className="text-xs">{cotizacion.origen || '-'} → {cotizacion.destino || '-'}</TableCell>
                  <TableCell className="text-right text-xs">{formatCurrency(cotizacion.subtotal, cotizacion.moneda)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${getEstadoColor(cotizacion.estado)}`}>{cotizacion.estado}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{cotizacion.fecha_vigencia ? formatDate(cotizacion.fecha_vigencia) : '-'}</TableCell>
                  <TableCell className="text-xs">{formatDate(cotizacion.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>
    </div>
  );
}
