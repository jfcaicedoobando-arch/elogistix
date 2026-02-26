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
import { facturas, embarques, formatDate, formatCurrency, getEstadoColor } from "@/data/mockData";
import type { EstadoFactura } from "@/data/types";

const ESTADOS_FACTURA: EstadoFactura[] = ['Borrador', 'Emitida', 'Pagada', 'Vencida', 'Cancelada'];

export default function Facturacion() {
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("todos");

  const filtered = useMemo(() => {
    return facturas.filter(f => {
      const matchSearch = !search || f.numero.toLowerCase().includes(search.toLowerCase()) || f.clienteNombre.toLowerCase().includes(search.toLowerCase());
      const matchEstado = filterEstado === "todos" || f.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [search, filterEstado]);

  // Gastos pendientes
  const gastosPendientes = embarques.flatMap(e =>
    e.conceptosCosto.filter(c => c.estadoLiquidacion === 'Pendiente').map(c => ({ ...c, expediente: e.expediente, embarqueId: e.id }))
  );

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
                  {filtered.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.numero}</TableCell>
                      <TableCell>{f.expediente}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{f.clienteNombre}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(f.total, f.moneda)}</TableCell>
                      <TableCell>{f.moneda}</TableCell>
                      <TableCell className="text-xs">{formatDate(f.fechaEmision)}</TableCell>
                      <TableCell className="text-xs">{formatDate(f.fechaVencimiento)}</TableCell>
                      <TableCell><Badge className={getEstadoColor(f.estado)}>{f.estado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="liquidacion">
          <Card>
            <CardContent className="p-0">
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
                  {gastosPendientes.map((g, i) => (
                    <TableRow key={i}>
                      <TableCell>{g.proveedorNombre}</TableCell>
                      <TableCell className="font-medium">{g.expediente}</TableCell>
                      <TableCell>{g.concepto}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(g.monto, g.moneda)}</TableCell>
                      <TableCell>{g.moneda}</TableCell>
                      <TableCell className="text-xs">{g.fechaVencimiento ? formatDate(g.fechaVencimiento) : '-'}</TableCell>
                      <TableCell><Badge className={getEstadoColor('Pendiente')}>Pendiente</Badge></TableCell>
                      <TableCell><Button variant="outline" size="sm">Marcar Pagado</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
