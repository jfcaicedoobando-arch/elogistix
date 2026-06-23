/**
 * Diálogo: capturar motivo de rechazo de una tarifa.
 */
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (motivo: string) => void;
  pending?: boolean;
}

export function DialogRechazarTarifa({ open, onOpenChange, onConfirm, pending }: Props) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => { if (!open) setMotivo(""); }, [open]);

  const valido = motivo.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar tarifa</DialogTitle>
          <DialogDescription>
            Escribe un motivo claro para que el agente sepa qué corregir antes de reenviar la tarifa.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo-rechazo">Motivo (mínimo 5 caracteres)</Label>
          <Textarea
            id="motivo-rechazo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. El flete base parece duplicado. Revisa con la naviera."
            rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(motivo.trim())}
            disabled={!valido || pending}
          >
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
