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
        <div className="md:col-span-2"><Label>Nombre / Empresa *</Label><Input value={clienteForm.nombre} onChange={e => setClienteForm(p => ({ ...p, nombre: e.target.value }))} /></div>
        <div><Label>Contacto *</Label><Input value={clienteForm.contacto} onChange={e => setClienteForm(p => ({ ...p, contacto: e.target.value }))} /></div>
        <div><Label>Email</Label><Input value={clienteForm.email} onChange={e => setClienteForm(p => ({ ...p, email: e.target.value }))} /></div>
        <div><Label>Teléfono</Label><Input value={clienteForm.telefono} onChange={e => setClienteForm(p => ({ ...p, telefono: e.target.value }))} /></div>
        <div><Label>RFC</Label><Input value={clienteForm.rfc} onChange={e => setClienteForm(p => ({ ...p, rfc: e.target.value }))} /></div>
        <div className="md:col-span-2"><Label>Dirección</Label><Input value={clienteForm.direccion} onChange={e => setClienteForm(p => ({ ...p, direccion: e.target.value }))} /></div>
        <div><Label>Ciudad</Label><Input value={clienteForm.ciudad} onChange={e => setClienteForm(p => ({ ...p, ciudad: e.target.value }))} /></div>
        <div><Label>Estado</Label><Input value={clienteForm.estado} onChange={e => setClienteForm(p => ({ ...p, estado: e.target.value }))} /></div>
        <div><Label>C.P.</Label><Input value={clienteForm.cp} onChange={e => setClienteForm(p => ({ ...p, cp: e.target.value }))} /></div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
