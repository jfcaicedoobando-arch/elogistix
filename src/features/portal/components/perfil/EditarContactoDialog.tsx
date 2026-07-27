import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserCog } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useActualizarContactoPortal } from "@/features/portal/hooks";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactoActual: string;
  telefonoActual: string;
}

export function EditarContactoDialog({
  open,
  onOpenChange,
  contactoActual,
  telefonoActual,
}: Props) {
  const { toast } = useToast();
  const { mutateAsync, isPending } = useActualizarContactoPortal();
  const [nombre, setNombre] = useState(contactoActual);
  const [telefono, setTelefono] = useState(telefonoActual);

  useEffect(() => {
    if (open) {
      setNombre(contactoActual);
      setTelefono(telefonoActual);
    }
  }, [open, contactoActual, telefonoActual]);

  const handleSubmit = async () => {
    const trimmed = nombre.trim();
    if (!trimmed || trimmed.length > 100) {
      notifyError(undefined, { title: "Nombre inválido", description: "Ingresa un nombre (máx 100 caracteres).", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_EDITARCONTACTODIALOG_1" });
      return;
    }
    if (telefono.length > 30) {
      notifyError(undefined, { title: "Teléfono inválido", description: "Máximo 30 caracteres.", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_EDITARCONTACTODIALOG_2" });
      return;
    }
    try {
      await mutateAsync({ nombre: trimmed, telefono: telefono.trim() });
      toast({ title: "Contacto actualizado" });
      onOpenChange(false);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo actualizar",
        description: getErrorMessage(err),
        error: err,
        method: "PORTAL_EDITAR_CONTACTO",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={UserCog}
      title="Editar contacto"
      description="Actualiza el nombre y teléfono del contacto principal."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="perfil-contacto-nombre">Nombre del contacto</Label>
        <Input
          id="perfil-contacto-nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="perfil-contacto-telefono">Teléfono</Label>
        <Input
          id="perfil-contacto-telefono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          maxLength={30}
        />
      </div>
    </FormDialogShell>
  );
}
