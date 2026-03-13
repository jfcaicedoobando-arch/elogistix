import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";

interface ClienteData {
  nombre: string;
  rfc: string;
  direccion: string;
  ciudad: string;
  estado: string;
  cp: string;
  contacto: string;
  email: string;
  telefono: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteData;
  onSave: (data: ClienteData) => Promise<void>;
  isSaving: boolean;
}

export default function DialogEditarCliente({ open, onOpenChange, cliente, onSave, isSaving }: Props) {
  const [form, setForm] = useState<ClienteData>(cliente);

  useEffect(() => {
    if (open) setForm(cliente);
  }, [open, cliente]);

  const handleSubmit = async () => {
    if (!form.nombre.trim()) return;
    await onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
          <DialogDescription>Modifica los datos generales del cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-xs">Nombre / Razón Social<span className="text-destructive ml-0.5">*</span></Label>
            <Input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="mt-1" />
          </div>
          <div><Label className="text-xs">RFC</Label><Input value={form.rfc} onChange={e => setForm(p => ({ ...p, rfc: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Código Postal</Label><Input value={form.cp} onChange={e => setForm(p => ({ ...p, cp: e.target.value }))} className="mt-1" /></div>
          <div className="col-span-2"><Label className="text-xs">Dirección</Label><Input value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Ciudad</Label><Input value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Estado</Label><Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Contacto</Label><Input value={form.contacto} onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="mt-1" /></div>
          <div><Label className="text-xs">Teléfono</Label><Input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!form.nombre.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
