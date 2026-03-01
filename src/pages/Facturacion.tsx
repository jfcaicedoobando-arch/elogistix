import { useState, useMemo } from "react";
import { Search } from "lucide-react";
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
import type { Database } from "@/integrations/supabase/types";

type EstadoFactura = Database["public"]["Enums"]["estado_factura"];
const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const marcarPagado = useMarcarCostoPagado();

  const filtered = useMemo(() => {
    return facturas.filter(f => {
      const matchSearch = !search || f.numero.toLowerCase().includes(search.toLowerCase()) || f.cliente_nombre.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || f.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [search, filterEstado, facturas]);

  const handleMarcarPagado = (id: string) => {
    marcarPagado.mutate({ id }, {
      onSuccess: () => toast.success("Gasto marcado como pagado"),
      onError: () => toast.error("Error al marcar como pagado"),
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturación y Liquidación</h1>

      <Tabs defaultValue="facturas">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="liquidacion">Liquidación de Gastos</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar factura o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterEstado} onValueChange={setFilterEstado}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ESTADOS_FACTURA.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loadingFacturas ? (
                <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
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
                    ) : filtered.map(f => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.numero}</TableCell>
                        <TableCell>{f.expediente}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{f.cliente_nombre}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(f.total, f.moneda)}</TableCell>
                        <TableCell>{f.moneda}</TableCell>
                        <TableCell className="text-xs">{formatDate(f.fecha_emision)}</TableCell>
                        <TableCell className="text-xs">{formatDate(f.fecha_vencimiento)}</TableCell>
                        <TableCell><Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liquidacion">
          <Card>
            <CardContent className="p-0">
              {loadingGastos ? (
                <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
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
                    ) : gastosPendientes.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{g.proveedor_nombre}</TableCell>
                        <TableCell className="font-medium">{(g.embarques as any)?.expediente || '-'}</TableCell>
                        <TableCell>{g.concepto}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(g.monto, g.moneda)}</TableCell>
                        <TableCell>{g.moneda}</TableCell>
                        <TableCell className="text-xs">{g.fecha_vencimiento ? formatDate(g.fecha_vencimiento) : '-'}</TableCell>
                        <TableCell><Badge className={getEstadoColor('Pendiente')}>Pendiente</Badge></TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={marcarPagado.isPending}
                            onClick={() => handleMarcarPagado(g.id)}
                          >
                            Marcar Pagado
                          </Button>
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
