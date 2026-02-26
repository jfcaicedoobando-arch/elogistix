import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Pencil, Trash2, Users, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { clientes as clientesIniciales, embarques, facturas, formatCurrency } from "@/data/mockData";
import type { ContactoCliente, TipoContacto } from "@/data/types";

const TIPOS_CONTACTO: TipoContacto[] = ['Proveedor', 'Exportador', 'Importador'];

const emptyContacto = {
  nombre: '', rfc: '', tipo: 'Proveedor' as TipoContacto, pais: '', ciudad: '', direccion: '', contacto: '', email: '', telefono: '',
};

export default function ClienteDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const cliente = clientesIniciales.find(c => c.id === id);
  const [contactos, setContactos] = useState<ContactoCliente[]>(cliente?.contactos || []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyContacto);

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-muted-foreground">Cliente no encontrado</p>
        <Button variant="outline" onClick={() => navigate("/clientes")}>Volver a Clientes</Button>
      </div>
    );
  }

  const clienteEmbarques = embarques.filter(e => e.clienteId === id);
  const clienteFacturas = facturas.filter(f => f.clienteId === id);
  const saldoPendiente = clienteFacturas
    .filter(f => ['Emitida', 'Vencida'].includes(f.estado))
    .reduce((sum, f) => sum + f.total, 0);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openNew = () => {
    setEditingId(null);
    setForm(emptyContacto);
    setDialogOpen(true);
  };

  const openEdit = (ct: ContactoCliente) => {
    setEditingId(ct.id);
    setForm({ nombre: ct.nombre, rfc: ct.rfc, tipo: ct.tipo, pais: ct.pais, ciudad: ct.ciudad, direccion: ct.direccion, contacto: ct.contacto, email: ct.email, telefono: ct.telefono });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.nombre.trim()) return;
    if (editingId) {
      setContactos(prev => prev.map(c => c.id === editingId ? { ...c, ...form } : c));
    } else {
      const nuevo: ContactoCliente = { id: `CT-${Date.now()}`, clienteId: cliente.id, ...form };
      setContactos(prev => [...prev, nuevo]);
    }
    setDialogOpen(false);
    setForm(emptyContacto);
    setEditingId(null);
  };

  const handleDelete = (ctId: string) => {
    setContactos(prev => prev.filter(c => c.id !== ctId));
  };

  const tipoBadgeVariant = (tipo: TipoContacto) => {
    switch (tipo) {
      case 'Proveedor': return 'default';
      case 'Exportador': return 'secondary';
      case 'Importador': return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{cliente.nombre}</h1>
          <p className="text-sm text-muted-foreground">{cliente.rfc}</p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Información General</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{cliente.direccion}</p>
            <p>{cliente.ciudad}, {cliente.estado} {cliente.cp}</p>
            <div className="pt-2 border-t mt-2 space-y-1">
              <p><span className="text-muted-foreground">Contacto:</span> {cliente.contacto}</p>
              <p><span className="text-muted-foreground">Email:</span> {cliente.email}</p>
              <p><span className="text-muted-foreground">Tel:</span> {cliente.telefono}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
            <p className={`text-xl font-bold ${saldoPendiente > 0 ? 'text-destructive' : 'text-success'}`}>
              {formatCurrency(saldoPendiente)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Actividad</p>
            <p className="text-xl font-bold">{clienteEmbarques.length} <span className="text-sm font-normal text-muted-foreground">embarques</span></p>
            <p className="text-sm text-muted-foreground">{clienteFacturas.length} facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Contacts table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Proveedores / Exportadores</CardTitle>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Agregar Contacto</Button>
        </CardHeader>
        <CardContent className="p-0">
          {contactos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No hay contactos registrados. Agrega proveedores o exportadores para usarlos en embarques.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>País / Ciudad</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactos.map(ct => (
                  <TableRow key={ct.id}>
                    <TableCell className="font-medium">{ct.nombre}</TableCell>
                    <TableCell><Badge variant={tipoBadgeVariant(ct.tipo)}>{ct.tipo}</Badge></TableCell>
                    <TableCell className="text-xs">{ct.pais}, {ct.ciudad}</TableCell>
                    <TableCell className="text-xs">{ct.contacto}</TableCell>
                    <TableCell className="text-xs">{ct.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ct)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(ct.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
            <DialogDescription>Proveedor, exportador o importador asociado a este cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label className="text-xs">Nombre<span className="text-destructive ml-0.5">*</span></Label>
              <Input value={form.nombre} onChange={e => handleChange('nombre', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => handleChange('tipo', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_CONTACTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">RFC</Label>
              <Input value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">País</Label>
              <Input value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ciudad</Label>
              <Input value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Dirección</Label>
              <Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Contacto</Label>
              <Input value={form.contacto} onChange={e => handleChange('contacto', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={e => handleChange('email', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.telefono} onChange={e => handleChange('telefono', e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nombre.trim()}>{editingId ? 'Guardar Cambios' : 'Agregar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
