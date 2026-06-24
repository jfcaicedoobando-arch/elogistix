import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import { getErrorMessage } from "@/lib/errors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identificador de telemetría para distinguir origen (portal vs interno). */
  method?: string;
}

/**
 * Diálogo compartido para que cualquier usuario autenticado (interno o de
 * portal) cambie su propia contraseña. Llama a `supabase.auth.updateUser`
 * directamente, así que no requiere RPC ni rol específico.
 */
export function CambiarPasswordDialog({
  open,
  onOpenChange,
  method = "CAMBIAR_PASSWORD",
}: Props) {
  const { toast } = useToast();
  const [nueva, setNueva] = useState("");
  const [confirma, setConfirma] = useState("");
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setNueva("");
      setConfirma("");
      setIsPending(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (nueva.length < 8) {
      notifyError(toast, {
        title: "Contraseña muy corta",
        description: "Mínimo 8 caracteres.",
        method: `${method}_LEN`,
      });
      return;
    }
    if (nueva !== confirma) {
      notifyError(toast, {
        title: "No coinciden",
        description: "La confirmación no coincide.",
        method: `${method}_MISMATCH`,
      });
      return;
    }
    setIsPending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva });
      if (error) throw error;
      toast({ title: "Contraseña actualizada" });
      onOpenChange(false);
    } catch (err) {
      notifyError(toast, {
        title: "No se pudo actualizar la contraseña",
        description: traducirErrorPassword(getErrorMessage(err)),
        error: err,
        method,
      });
    } finally {
      setIsPending(false);
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
          <Label htmlFor="cambiar-pass-nueva">Nueva contraseña</Label>
          <Input
            id="cambiar-pass-nueva"
            type="password"
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            autoComplete="new-password"
            maxLength={72}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cambiar-pass-confirma">Confirmar contraseña</Label>
          <Input
            id="cambiar-pass-confirma"
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
