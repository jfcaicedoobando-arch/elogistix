import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Enums, Tables, TablesUpdate } from "@/integrations/supabase/types";
type TipoProveedor = Enums<'tipo_proveedor'>;
type Moneda = Enums<'moneda'>;
import { TIPOS_PROVEEDOR as TIPOS, MONEDAS_PROVEEDOR as MONEDAS, PAISES_PROVEEDOR as PAISES } from "@/data/proveedorConstants";

type Proveedor = Tables<'proveedores'>;

interface Props {
  proveedor: Proveedor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: TablesUpdate<"proveedores">) => void;
}

export default function EditarProveedorDialog({ proveedor, open, onOpenChange, onSave }: Props) {
  const [form, setForm] = useState({ ...proveedor });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setForm({ ...proveedor });
      setTouched({});
    }
  }, [open, proveedor]);

  const isAgenteCarga = form.tipo === 'Agente de Carga';
  const rfcLabel = form.origen_proveedor === 'Extranjero' ? 'Tax ID' : 'RFC';

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.origen_proveedor) e.origen_proveedor = "El origen es requerido";
    if (!form.nombre.trim()) e.nombre = "El nombre es requerido";
    if (!form.rfc.trim()) e.rfc = `El ${form.origen_proveedor === 'Extranjero' ? 'Tax ID' : 'RFC'} es requerido`;
    if (isAgenteCarga && !form.pais) e.pais = "El país es requerido";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido";
    return e;
  }, [form.origen_proveedor, form.nombre, form.rfc, form.pais, form.email, isAgenteCarga]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  const handleSave = () => {
    if (!isValid) {
      // Mark all fields as touched to show errors
      setTouched({ origen_proveedor: true, nombre: true, rfc: true, pais: true, email: true });
      return;
    }
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

  const fieldError = (field: string) =>
    touched[field] && errors[field] ? (
      <p className="text-sm text-destructive">{errors[field]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Proveedor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Origen *</Label>
            <Select value={form.origen_proveedor || ''} onValueChange={valorSeleccionado => { setForm(f => ({ ...f, origen_proveedor: valorSeleccionado as 'Nacional' | 'Extranjero' })); markTouched('origen_proveedor'); }}>
              <SelectTrigger><SelectValue placeholder="Selecciona origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Extranjero">Extranjero</SelectItem>
              </SelectContent>
            </Select>
            {fieldError('origen_proveedor')}
          </div>
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} onBlur={() => markTouched('nombre')} />
            {fieldError('nombre')}
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
              <Select value={form.pais || ''} onValueChange={valorSeleccionado => { setForm(f => ({ ...f, pais: valorSeleccionado, rfc: '' })); markTouched('pais'); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona un país" /></SelectTrigger>
                <SelectContent>
                  {PAISES.map(pais => <SelectItem key={pais} value={pais}>{pais}</SelectItem>)}
                </SelectContent>
              </Select>
              {fieldError('pais')}
            </div>
          )}

          {(!isAgenteCarga || form.pais) && (
            <div className="space-y-2">
              <Label>{rfcLabel} *</Label>
              <Input
                value={form.rfc}
                onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))}
                onBlur={() => markTouched('rfc')}
                placeholder={form.origen_proveedor === 'Extranjero' ? 'Ingresa el Tax ID' : 'Ingresa el RFC'}
              />
              {fieldError('rfc')}
            </div>
          )}

          <div className="space-y-2">
            <Label>Contacto</Label>
            <Input value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onBlur={() => markTouched('email')} />
            {fieldError('email')}
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Moneda Preferida</Label>
            <Select value={form.moneda_preferida} onValueChange={valorSeleccionado => setForm(f => ({ ...f, moneda_preferida: valorSeleccionado as Moneda }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEDAS.map(moneda => <SelectItem key={moneda} value={moneda}>{moneda}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isValid}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
