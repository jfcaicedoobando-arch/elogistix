import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TipoProveedor, Moneda } from "@/data/types";
import { TIPOS_PROVEEDOR as TIPOS, MONEDAS_PROVEEDOR as MONEDAS, PAISES_PROVEEDOR as PAISES } from "@/data/proveedorConstants";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

type Proveedor = Tables<'proveedores'>;

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: TablesUpdate<"proveedores">) => void;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({ ...proveedor });

  useEffect(() => {
    if (open) setForm({ ...proveedor });
  }, [open, proveedor]);

  const isAgenteCarga = form.tipo === 'Agente de Carga';
  const rfcLabel = form.origen_proveedor === 'Extranjero' ? 'Tax ID' : 'RFC';

  const handleSave = () => {
    onSave(proveedor.id, form);
    onOpenChange(false);
  };

  const handleTipoChange = (valorSeleccionado: string) => {
    setForm(formularioActual => ({
      ...formularioActual,
      tipo: valorSeleccionado as TipoProveedor,
      pais: valorSeleccionado === 'Agente de Carga' ? formularioActual.pais : '',
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
            <Select value={form.origen_proveedor || ''} onValueChange={valorSeleccionado => setForm(formularioActual => ({ ...formularioActual, origen_proveedor: valorSeleccionado as 'Nacional' | 'Extranjero' }))}>
              <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Extranjero">Extranjero</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={e => setForm(formularioActual => ({ ...formularioActual, nombre: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={handleTipoChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(tipoProveedor => <SelectItem key={tipoProveedor} value={tipoProveedor}>{tipoProveedor}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isAgenteCarga && (
            <div className="space-y-2">
              <Label>País *</Label>
              <Select value={form.pais || ''} onValueChange={valorSeleccionado => setForm(formularioActual => ({ ...formularioActual, pais: valorSeleccionado, rfc: '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                <SelectContent>
                  {PAISES.map(pais => <SelectItem key={pais} value={pais}>{pais}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {(!isAgenteCarga || form.pais) && (
            <div className="space-y-2">
              <Label>{rfcLabel}</Label>
              <Input
                value={form.rfc}
                onChange={e => setForm(formularioActual => ({ ...formularioActual, rfc: e.target.value }))}
                placeholder={form.origen_proveedor === 'Extranjero' ? 'Ingresa el Tax ID' : 'Ingresa el RFC'}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={e => setForm(formularioActual => ({ ...formularioActual, contacto: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(formularioActual => ({ ...formularioActual, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={e => setForm(formularioActual => ({ ...formularioActual, telefono: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Moneda Preferida</Label>
            <Select value={form.moneda_preferida} onValueChange={valorSeleccionado => setForm(formularioActual => ({ ...formularioActual, moneda_preferida: valorSeleccionado as Moneda }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEDAS.map(moneda => <SelectItem key={moneda} value={moneda}>{moneda}</SelectItem>)}
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
