import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Proveedor, TipoProveedor, Moneda } from "@/data/types";

const TIPOS: TipoProveedor[] = ['Naviera', 'Aerolínea', 'Transportista', 'Agente Aduanal', 'Agente de Carga', 'Aseguradora', 'Custodia', 'Almacenes', 'Acondicionamiento de Carga', 'Materiales Peligrosos'];
const MONEDAS: Moneda[] = ['MXN', 'USD', 'EUR'];

const PAISES = [
  'México', 'Estados Unidos', 'Canadá', 'China', 'Alemania', 'España',
  'Francia', 'Italia', 'Japón', 'Corea del Sur', 'Brasil', 'Colombia',
  'Chile', 'Argentina', 'Perú', 'Reino Unido', 'India', 'Otro',
];

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

  const isAgenteCarga = form.tipo === 'Agente de Carga';
  const isMexico = form.pais === 'México';
  const rfcLabel = form.origenProveedor === 'Extranjero' ? 'Tax ID' : 'RFC';

  const handleSave = () => {
    onSave(proveedor.id, form);
    onOpenChange(false);
  };

  const handleTipoChange = (v: string) => {
    setForm(f => ({
      ...f,
      tipo: v as TipoProveedor,
      pais: v === 'Agente de Carga' ? f.pais : '',
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origen</Label>
            <Select value={form.origenProveedor || ''} onValueChange={v => setForm(f => ({ ...f, origenProveedor: v as 'Nacional' | 'Extranjero' }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Extranjero">Extranjero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={handleTipoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isAgenteCarga && (
            <div className="space-y-2">
              <Label>País *</Label>
              <Select value={form.pais || ''} onValueChange={v => setForm(f => ({ ...f, pais: v, rfc: '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                <SelectContent>
                  {PAISES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(!isAgenteCarga || form.pais) && (
            <div className="space-y-2">
              <Label>{rfcLabel}</Label>
              <Input
                value={form.rfc}
                onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                placeholder={form.origenProveedor === 'Extranjero' ? 'Ingresa el Tax ID' : 'Ingresa el RFC'}
              />
            </div>
          )}

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
