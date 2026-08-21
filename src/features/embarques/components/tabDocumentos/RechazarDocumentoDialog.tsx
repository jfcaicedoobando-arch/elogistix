/**
 * Diálogo de rechazo de un documento del embarque (O5.3).
 * Quien revisa explica por qué el archivo no sirve; el documento vuelve a
 * quedar como faltante y se notifica a quien abrió el embarque.
 */
import { useState } from "react";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoNombre: string;
  pendiente: boolean;
  onConfirm: (motivo: string) => Promise<void> | void;
}

const MIN_MOTIVO = 10;

export function RechazarDocumentoDialog({
  open, onOpenChange, documentoNombre, pendiente, onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const valido = motivo.trim().length >= MIN_MOTIVO;

  const cerrar = () => {
    setMotivo("");
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => { if (!v) cerrar(); }}
      icon={XCircle}
      title={`Rechazar "${documentoNombre}"`}
      description="Se quitará el archivo adjunto, el documento volverá a contar como faltante y se avisará a quien abrió el embarque."
      size="md"
      footer={(
        <>
          <Button variant="outline" onClick={cerrar} disabled={pendiente}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={pendiente || !valido}
            onClick={async () => { await onConfirm(motivo.trim()); setMotivo(""); }}
          >
            {pendiente ? "Rechazando…" : "Rechazar documento"}
          </Button>
        </>
      )}
    >
      <FormDialogSection title="Motivo del rechazo" cols={1}>
        <div className="space-y-2">
          <Label htmlFor="motivo-rechazo-documento">
            Explica el motivo (mín. {MIN_MOTIVO} caracteres)
          </Label>
          <Textarea
            id="motivo-rechazo-documento"
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. El BL está ilegible y no coincide el número de contenedor."
          />
        </div>
      </FormDialogSection>
    </FormDialogShell>
  );
}
