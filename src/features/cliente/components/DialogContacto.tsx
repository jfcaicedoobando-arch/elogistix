import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { Tables, Enums } from "@/types/db";
type ContactoCliente = Tables<'contactos_cliente'>;
type TipoContacto = Enums<'tipo_contacto'>;

const TIPOS_CONTACTO: TipoContacto[] = ['Exportador', 'Importador'];

/** Normaliza a cadena: filas legacy o entradas sin valor no deben viajar como null. */
const texto = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');

const emptyForm = {
  nombre: '', rfc: '', tipo: 'Exportador' as TipoContacto, pais: '', ciudad: '', direccion: '', contacto: '', email: '', telefono: '',
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
        nombre: texto(contacto.nombre), rfc: texto(contacto.rfc), tipo: contacto.tipo ?? 'Exportador',
        pais: texto(contacto.pais), ciudad: texto(contacto.ciudad), direccion: texto(contacto.direccion),
        contacto: texto(contacto.contacto), email: texto(contacto.email), telefono: texto(contacto.telefono),
      });
    } else {
      setForm(emptyForm);
    }
  }, [contacto, open]);

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    const nombre = texto(form.nombre).trim();
    if (!nombre) return;
    // Las columnas de texto son NOT NULL en la base: nunca enviamos null/undefined.
    await onSave(
      {
        nombre,
        rfc: texto(form.rfc).trim(),
        tipo: form.tipo ?? 'Exportador',
        pais: texto(form.pais).trim(),
        ciudad: texto(form.ciudad).trim(),
        direccion: texto(form.direccion).trim(),
        contacto: texto(form.contacto).trim(),
        email: texto(form.email).trim(),
        telefono: texto(form.telefono).trim(),
      },
      contacto?.id ?? null,
    );
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={User}
      title={contacto ? 'Editar Contacto' : 'Nuevo Contacto'}
      description="Exportador o importador asociado a este cliente."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre.trim()} loading={isSaving}>
            {contacto ? 'Guardar Cambios' : 'Agregar'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="contacto-nombre">Nombre<span className="text-destructive ml-0.5">*</span></Label>
          <Input id="contacto-nombre" value={form.nombre} onChange={e => handleChange('nombre', e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="contacto-tipo">Tipo</Label>
          <Select value={form.tipo} onValueChange={v => handleChange('tipo', v)}>
            <SelectTrigger id="contacto-tipo" className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS_CONTACTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label htmlFor="contacto-rfc">Tax ID</Label><Input id="contacto-rfc" value={form.rfc} onChange={e => handleChange('rfc', e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="contacto-pais">País</Label><Input id="contacto-pais" value={form.pais} onChange={e => handleChange('pais', e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="contacto-ciudad">Ciudad</Label><Input id="contacto-ciudad" value={form.ciudad} onChange={e => handleChange('ciudad', e.target.value)} className="mt-1" /></div>
        <div className="sm:col-span-2"><Label htmlFor="contacto-direccion">Dirección</Label><Input id="contacto-direccion" value={form.direccion} onChange={e => handleChange('direccion', e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="contacto-contacto">Contacto</Label><Input id="contacto-contacto" value={form.contacto} onChange={e => handleChange('contacto', e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="contacto-email">Email</Label><Input id="contacto-email" value={form.email} onChange={e => handleChange('email', e.target.value)} className="mt-1" /></div>
        <div><Label htmlFor="contacto-telefono">Teléfono</Label><Input id="contacto-telefono" value={form.telefono} onChange={e => handleChange('telefono', e.target.value)} className="mt-1" /></div>
      </div>
    </FormDialogShell>
  );
}
