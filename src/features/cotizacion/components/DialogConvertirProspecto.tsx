import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

import type { ClienteFormData } from "@/features/cliente/types/clienteForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteForm: ClienteFormData;
  setClienteForm: React.Dispatch<React.SetStateAction<ClienteFormData>>;
  onConvertir: () => void;
  isPending: boolean;
}

export default function DialogConvertirProspecto({
  open, onOpenChange, clienteForm, setClienteForm, onConvertir, isPending,
}: Props) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCheck}
      title="Convertir Prospecto a Cliente"
      description="Convierte el prospecto en cliente registrado para habilitar la generación de embarques."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onConvertir} disabled={isPending}>
            {isPending ? 'Creando...' : 'Crear Cliente'}
          </Button>
        </>
      }
    >
      <FormDialogSection>
        <div className="md:col-span-2"><Label htmlFor="conv-nombre">Nombre / Empresa *</Label><Input id="conv-nombre" value={clienteForm.nombre} onChange={e => setClienteForm(p => ({ ...p, nombre: e.target.value }))} /></div>
        <div><Label htmlFor="conv-contacto">Contacto *</Label><Input id="conv-contacto" value={clienteForm.contacto} onChange={e => setClienteForm(p => ({ ...p, contacto: e.target.value }))} /></div>
        <div><Label htmlFor="conv-email">Email</Label><Input id="conv-email" value={clienteForm.email} onChange={e => setClienteForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><Label htmlFor="conv-telefono">Teléfono</Label><Input id="conv-telefono" value={clienteForm.telefono} onChange={e => setClienteForm(p => ({ ...p, telefono: e.target.value }))} /></div>
        <div><Label htmlFor="conv-rfc">RFC</Label><Input id="conv-rfc" value={clienteForm.rfc} onChange={e => setClienteForm(p => ({ ...p, rfc: e.target.value }))} /></div>
        <div className="md:col-span-2"><Label htmlFor="conv-direccion">Dirección</Label><Input id="conv-direccion" value={clienteForm.direccion} onChange={e => setClienteForm(p => ({ ...p, direccion: e.target.value }))} /></div>
        <div><Label htmlFor="conv-ciudad">Ciudad</Label><Input id="conv-ciudad" value={clienteForm.ciudad} onChange={e => setClienteForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
        <div><Label htmlFor="conv-estado">Estado</Label><Input id="conv-estado" value={clienteForm.estado} onChange={e => setClienteForm(p => ({ ...p, estado: e.target.value }))} /></div>
        <div><Label htmlFor="conv-cp">C.P.</Label><Input id="conv-cp" value={clienteForm.cp} onChange={e => setClienteForm(p => ({ ...p, cp: e.target.value }))} /></div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
