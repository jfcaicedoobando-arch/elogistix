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
import { useCambiarPasswordPortal } from "@/hooks/portal";
import { useToast } from "@/hooks/shared";
import { notifyError } from "@/lib/ui/appFeedback";
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
      toast({ title: "Contraseña muy corta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (nueva !== confirma) {
      toast({ title: "No coinciden", description: "La confirmación no coincide.", variant: "destructive" });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>Ingresa tu nueva contraseña (mínimo 8 caracteres).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
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
