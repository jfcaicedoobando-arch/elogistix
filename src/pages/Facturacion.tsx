import { useState, useMemo } from "react";
import SearchInput from "@/components/SearchInput";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useFacturas, useGastosPendientes, useMarcarCostoPagado } from "@/hooks/useFacturas";
import { formatCurrency } from "@/lib/formatters";
import { formatDate, getEstadoColor } from "@/lib/helpers";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import PaginationControls from "@/components/PaginationControls";
import type { Database } from "@/integrations/supabase/types";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];
const DEFAULT_PAGE_SIZE = 20;

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const marcarPagado = useMarcarCostoPagado();
  const { canEdit } = usePermissions();

  const filtered = useMemo(() => {
    return facturas.filter(factura => {
      const matchSearch = !search || factura.numero.toLowerCase().includes(search.toLowerCase()) || factura.cliente_nombre.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || factura.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [search, filterEstado, facturas]);

  const paginatedFacturas = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleMarcarPagado = (id: string) => {
    marcarPagado.mutate({ id }, {
      onSuccess: () => toast.success("Gasto marcado como pagado"),
      onError: () => toast.error("Error al marcar como pagado"),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Facturación y Liquidación</h1>
        <p className="text-sm text-muted-foreground">Control de facturas emitidas y gastos por liquidar</p>
      </div>

      <Tabs defaultValue="facturas">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder="Buscar factura o cliente..." className="flex-1 min-w-[200px]" />
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS_FACTURA.map(estadoFactura => <SelectItem key={estadoFactura} value={estadoFactura}>{estadoFactura}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loadingFacturas ? (
                <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, indice) => <Skeleton key={indice} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead># Factura</TableHead>
                      <TableHead>Expediente</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Emisión</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No se encontraron facturas</TableCell></TableRow>
                    ) : paginatedFacturas.map(factura => (
                      <TableRow key={factura.id}>
                        <TableCell className="font-medium">{factura.numero}</TableCell>
                        <TableCell>{factura.expediente}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{factura.cliente_nombre}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(factura.total, factura.moneda)}</TableCell>
                        <TableCell>{factura.moneda}</TableCell>
                        <TableCell className="text-xs">{formatDate(factura.fecha_emision)}</TableCell>
                        <TableCell className="text-xs">{formatDate(factura.fecha_vencimiento)}</TableCell>
                        <TableCell><Badge className={getEstadoColor(factura.estado)}>{factura.estado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liquidacion">
          <Card>
            <CardContent className="p-0">
              {loadingGastos ? (
                <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, indice) => <Skeleton key={indice} className="h-10 w-full" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Expediente</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Moneda</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gastosPendientes.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No hay gastos pendientes</TableCell></TableRow>
                    ) : gastosPendientes.map((gasto) => (
                      <TableRow key={gasto.id}>
                        <TableCell>{gasto.proveedor_nombre}</TableCell>
                        <TableCell className="font-medium">{(gasto.embarques as any)?.expediente || '-'}</TableCell>
                        <TableCell>{gasto.concepto}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(gasto.monto, gasto.moneda)}</TableCell>
                        <TableCell>{gasto.moneda}</TableCell>
                        <TableCell className="text-xs">{gasto.fecha_vencimiento ? formatDate(gasto.fecha_vencimiento) : '-'}</TableCell>
                        <TableCell><Badge className={getEstadoColor('Pendiente')}>Pendiente</Badge></TableCell>
                        <TableCell>
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={marcarPagado.isPending}
                              onClick={() => handleMarcarPagado(gasto.id)}
                            >
                              Marcar Pagado
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
