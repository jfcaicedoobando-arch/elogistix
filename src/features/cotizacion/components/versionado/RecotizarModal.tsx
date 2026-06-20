/**
 * Modal: re-cotizar una cotización ya aceptada (Fase 2).
 *
 * Pide motivo obligatorio + confirmación tipeada "RECOTIZAR" para evitar
 * pérdidas accidentales del histórico aceptado por el cliente.
 */
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useRecotizarCotizacion } from "@/features/cotizacion/hooks/useVersionadoCotizacion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionId: string;
  versionActual: number;
  onSuccess?: () => void;
}

export function RecotizarModal({
  open,
  onOpenChange,
  cotizacionId,
  versionActual,
  onSuccess,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const mut = useRecotizarCotizacion();

  const canSubmit = motivo.trim().length >= 5 && confirmacion === "RECOTIZAR";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await mut.mutateAsync({ cotizacionId, motivo });
    onOpenChange(false);
    setMotivo("");
    setConfirmacion("");
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-cotizar (crear v{versionActual + 1})</DialogTitle>
          <DialogDescription>
            La versión actual (v{versionActual}) quedará archivada como referencia
            histórica. El cliente deberá aceptar la nueva versión.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            La versión aceptada se conserva intacta para reconciliación. Esta
            acción no afecta embarques ya creados.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <div>
            <Label htmlFor="motivo-recotizar">Motivo (mínimo 5 caracteres)</Label>
            <Textarea
              id="motivo-recotizar"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Cliente solicitó cambio de origen y nueva tarifa naviera."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="conf-recotizar">
              Escribe <strong>RECOTIZAR</strong> para confirmar
            </Label>
            <Input
              id="conf-recotizar"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder="RECOTIZAR"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || mut.isPending}>
            {mut.isPending ? "Re-cotizando..." : "Confirmar re-cotización"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
