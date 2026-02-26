import { useState } from "react";
import { Search, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { proveedores, embarques, formatCurrency, getEstadoColor } from "@/data/mockData";
import type { TipoProveedor } from "@/data/types";

const TIPOS: TipoProveedor[] = ['Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Terminal'];

export default function Proveedores() {
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = proveedores.filter(p => {
    const matchSearch = !search || p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === "todos" || p.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const selectedProv = proveedores.find(p => p.id === selected);
  const provGastos = embarques.flatMap(e =>
    e.conceptosCosto.filter(c => c.proveedorId === selected).map(c => ({ ...c, expediente: e.expediente }))
  );
  const totalGastos = provGastos.reduce((sum, g) => sum + g.monto, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold">Proveedores</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Moneda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id} className={`cursor-pointer ${selected === p.id ? 'bg-accent/10' : ''}`} onClick={() => setSelected(p.id)}>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{p.tipo}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{p.rfc}</TableCell>
                      <TableCell className="text-xs">{p.contacto}</TableCell>
                      <TableCell className="text-xs">{p.monedaPreferida}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedProv ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Detalle del Proveedor</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{selectedProv.nombre}</p>
                  <Badge variant="secondary">{selectedProv.tipo}</Badge>
                  <div className="pt-2 space-y-1">
                    <p><span className="text-muted-foreground">RFC:</span> {selectedProv.rfc}</p>
                    <p><span className="text-muted-foreground">Contacto:</span> {selectedProv.contacto}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedProv.email}</p>
                    <p><span className="text-muted-foreground">Tel:</span> {selectedProv.telefono}</p>
                    <p><span className="text-muted-foreground">Moneda:</span> {selectedProv.monedaPreferida}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Historial de Gastos</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {provGastos.length > 0 ? (
                    <Table>
                      <TableHeader><TableRow><TableHead>Expediente</TableHead><TableHead>Concepto</TableHead><TableHead>Monto</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {provGastos.map((g, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-medium">{g.expediente}</TableCell>
                            <TableCell className="text-xs">{g.concepto}</TableCell>
                            <TableCell className="text-xs font-medium">{formatCurrency(g.monto, g.moneda)}</TableCell>
                            <TableCell><Badge className={`text-xs ${getEstadoColor(g.estadoLiquidacion)}`}>{g.estadoLiquidacion}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="p-4 text-sm text-muted-foreground text-center">Sin gastos registrados</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Selecciona un proveedor para ver su detalle
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
