import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useActualizarContactoPortal } from "@/features/portal/hooks";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { scrollableDialog } from "@/components/shared/utils/dialogTokens";

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
      notifyError(toast, { title: "Nombre inválido", description: "Ingresa un nombre (máx 100 caracteres).", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_EDITARCONTACTODIALOG_1" });
      return;
    }
    if (telefono.length > 30) {
      notifyError(toast, { title: "Teléfono inválido", description: "Máximo 30 caracteres.", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_EDITARCONTACTODIALOG_2" });
      return;
    }
    try {
      await mutateAsync({ nombre: trimmed, telefono: telefono.trim() });
      toast({ title: "Contacto actualizado" });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo actualizar",
        description: getErrorMessage(err),
        error: err,
        method: "PORTAL_EDITAR_CONTACTO",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", scrollableDialog)}>
        <DialogHeader>
          <DialogTitle>Editar contacto</DialogTitle>
          <DialogDescription>Actualiza el nombre y teléfono del contacto principal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
