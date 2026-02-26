import { useState } from "react";
import { Search, Users, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { clientes as clientesIniciales, embarques, facturas, formatCurrency } from "@/data/mockData";
import { Cliente } from "@/data/types";

const emptyCliente = {
  nombre: "", rfc: "", direccion: "", ciudad: "", estado: "", cp: "", contacto: "", email: "", telefono: "",
};

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [clientesList, setClientesList] = useState<Cliente[]>(clientesIniciales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCliente);

  const filtered = clientesList.filter(c =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) || c.rfc.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCliente = clientesList.find(c => c.id === selected);
  const clienteEmbarques = embarques.filter(e => e.clienteId === selected);
  const clienteFacturas = facturas.filter(f => f.clienteId === selected);
  const saldoPendiente = clienteFacturas
    .filter(f => ['Emitida', 'Vencida'].includes(f.estado))
    .reduce((sum, f) => sum + f.total, 0);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.nombre.trim() || !form.rfc.trim() || !form.cp.trim()) return;
    const nuevo: Cliente = { id: `CLI-${Date.now()}`, ...form };
    setClientesList(prev => [...prev, nuevo]);
    setForm(emptyCliente);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold">Clientes</h1>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo Cliente</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o RFC..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Teléfono</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id} className={`cursor-pointer ${selected === c.id ? 'bg-accent/10' : ''}`} onClick={() => setSelected(c.id)}>
                      <TableCell className="font-medium max-w-[200px] truncate">{c.nombre}</TableCell>
                      <TableCell className="text-xs font-mono">{c.rfc}</TableCell>
                      <TableCell className="text-xs">{c.ciudad}, {c.estado}</TableCell>
                      <TableCell className="text-xs">{c.contacto}</TableCell>
                      <TableCell className="text-xs">{c.telefono}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          {selectedCliente ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Detalle del Cliente</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{selectedCliente.nombre}</p>
                  <p className="text-muted-foreground">{selectedCliente.rfc}</p>
                  <p className="text-muted-foreground">{selectedCliente.direccion}</p>
                  <p className="text-muted-foreground">{selectedCliente.ciudad}, {selectedCliente.estado} {selectedCliente.cp}</p>
                  <div className="pt-2 border-t space-y-1">
                    <p><span className="text-muted-foreground">Contacto:</span> {selectedCliente.contacto}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedCliente.email}</p>
                    <p><span className="text-muted-foreground">Tel:</span> {selectedCliente.telefono}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
                  <p className={`text-xl font-bold ${saldoPendiente > 0 ? 'text-destructive' : 'text-success'}`}>
                    {formatCurrency(saldoPendiente)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">{clienteEmbarques.length} embarques · {clienteFacturas.length} facturas</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Selecciona un cliente para ver su detalle
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>Ingresa los datos del nuevo cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Nombre / Razón Social", field: "nombre", full: true, required: true },
              { label: "RFC", field: "rfc", required: true },
              { label: "Código Postal", field: "cp", required: true },
              { label: "Dirección", field: "direccion", full: true },
              { label: "Ciudad", field: "ciudad" },
              { label: "Estado", field: "estado" },
              { label: "Contacto", field: "contacto" },
              { label: "Email", field: "email" },
              { label: "Teléfono", field: "telefono" },
            ].map(({ label, field, full, required }) => (
              <div key={field} className={full ? "col-span-2" : ""}>
                <Label className="text-xs">{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
                <Input
                  value={(form as any)[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  className="mt-1"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre.trim() || !form.rfc.trim() || !form.cp.trim()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
