import { useState } from "react";
import { Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

/** Longitud mínima del motivo exigida por la RPC `reabrir_embarque`. */
const MOTIVO_MIN = 20;

interface Props {
  expediente: string;
  reabriendoEstado: boolean;
  onReabrir: (motivo: string) => void;
}

export function ReabrirEmbarqueButton({ expediente, reabriendoEstado, onReabrir }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const motivoLimpio = motivo.trim();
  const motivoValido = motivoLimpio.length >= MOTIVO_MIN;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setMotivo("");
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={reabriendoEstado}
        onClick={() => setOpen(true)}
      >
        <Unlock className="h-4 w-4 mr-1" /> Reabrir
      </Button>
      <ConfirmActionDialog
        open={open}
        onOpenChange={handleOpenChange}
        size="md"
        title="Reabrir embarque cerrado"
        description={
          <>
            El embarque <strong>{expediente}</strong> regresará al estado <strong>Entregado</strong> para poder generar la proforma o ajustar facturación. La acción se registrará en la bitácora y en el tracking.
          </>
        }
        confirmLabel="Reabrir"
        isPending={reabriendoEstado}
        confirmDisabled={!motivoValido}
        onConfirm={() => {
          if (!motivoValido) return;
          onReabrir(motivoLimpio);
          handleOpenChange(false);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="motivo-reapertura">Motivo de la reapertura</Label>
          <Textarea
            id="motivo-reapertura"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ej. Se detectó un concepto de venta faltante y hay que emitir la proforma correcta."
          />
          <p className="text-xs text-muted-foreground">
            Mínimo {MOTIVO_MIN} caracteres ({motivoLimpio.length}/{MOTIVO_MIN}).
          </p>
        </div>
      </ConfirmActionDialog>
    </>
  );
}

