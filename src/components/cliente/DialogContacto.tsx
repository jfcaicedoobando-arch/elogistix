import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import type { Tables, Enums } from "@/integrations/supabase/types";
type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;

const TIPOS_CONTACTO: TipoContacto[] = ['Proveedor', 'Exportador', 'Importador'];

const emptyForm = {
  nombre: '', rfc: '', tipo: 'Proveedor' as TipoContacto, pais: '', ciudad: '', direccion: '', contacto: '', email: '', telefono: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacto: ContactoCliente | null;
  onSave: (data: typeof emptyForm, editingId: string | null) => Promise<void>;
  isSaving: boolean;
}

export default function DialogContacto({ open, onOpenChange, contacto, onSave, isSaving }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (contacto) {
      setForm({
        nombre: contacto.nombre, rfc: contacto.rfc, tipo: contacto.tipo,
        pais: contacto.pais, ciudad: contacto.ciudad, direccion: contacto.direccion,
        contacto: contacto.contacto, email: contacto.email, telefono: contacto.telefono,
      });
    } else {
      setForm(emptyForm);
    }
  }, [contacto, open]);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;
    await onSave(form, contacto?.id ?? null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contacto ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
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
          <div><Label className="text-xs">Tax ID</Label><Input value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">País</Label><Input value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Ciudad</Label><Input value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
          <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Contacto</Label><Input value={form.contacto} onChange={e => handleChange('contacto', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => handleChange('email', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Teléfono</Label><Input value={form.telefono} onChange={e => handleChange('telefono', e.target.value)} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {contacto ? 'Guardar Cambios' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
