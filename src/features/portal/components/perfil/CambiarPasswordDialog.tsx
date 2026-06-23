import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCambiarPasswordPortal } from "@/features/portal/hooks";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CambiarPasswordDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { mutateAsync, isPending } = useCambiarPasswordPortal();
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");

  useEffect(() => {
    if (!open) {
      setNueva("");
      setConfirma("");
    }
  }, [open]);

  const handleSubmit = async () => {
    if (nueva.length < 8) {
      notifyError(toast, { title: "Contraseña muy corta", description: "Mínimo 8 caracteres.", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_CAMBIARPASSWORDDIALOG_1" });
      return;
    }
    if (nueva !== confirma) {
      notifyError(toast, { title: "No coinciden", description: "La confirmación no coincide.", method: "FEATURES_PORTAL_COMPONENTS_PERFIL_CAMBIARPASSWORDDIALOG_2" });
      return;
    }
    try {
      await mutateAsync(nueva);
      toast({ title: "Contraseña actualizada" });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo actualizar la contraseña",
        description: getErrorMessage(err),
        error: err,
        method: "PORTAL_CAMBIAR_PASSWORD",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={KeyRound}
      title="Cambiar contraseña"
      description="Ingresa tu nueva contraseña (mínimo 8 caracteres)."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="perfil-pass-nueva">Nueva contraseña</Label>
          <Input
            id="perfil-pass-nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="perfil-pass-confirma">Confirmar contraseña</Label>
          <Input
            id="perfil-pass-confirma"
            type="password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
          />
        </div>
      </div>
    </FormDialogShell>
  );
}
