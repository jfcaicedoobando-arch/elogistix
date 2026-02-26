import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Proveedor, TipoProveedor, Moneda } from "@/data/types";

const TIPOS: TipoProveedor[] = ['Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga', 'Aseguradora'];
const MONEDAS: Moneda[] = ['MXN', 'USD', 'EUR'];

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Proveedor>) => void;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({ ...proveedor });

  useEffect(() => {
    if (open) setForm({ ...proveedor });
  }, [open, proveedor]);

  const handleSave = () => {
    onSave(proveedor.id, form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoProveedor }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>RFC</Label>
            <Input value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Moneda Preferida</Label>
            <Select value={form.monedaPreferida} onValueChange={v => setForm(f => ({ ...f, monedaPreferida: v as Moneda }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
