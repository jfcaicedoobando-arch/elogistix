/** Confirmación "Cancelar anticipo" (QW6). FormDialogShell + motivo + RPC cancelar_anticipo_proveedor. */
import { useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useCancelarAnticipo } from "@/features/anticipos-proveedor/hooks/useAnticipoProveedorMutations";
import { notifyWarning } from "@/lib/ui/appFeedback";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  anticipo: AnticipoProveedorRow | null;
}

export function CancelarAnticipoDialog({ open, onOpenChange, anticipo }: Props) {
  const [motivo, setMotivo] = useState("");
  const cancelar = useCancelarAnticipo();

  const handleOpenChange = (o: boolean) => {
    if (!o) setMotivo("");
    onOpenChange(o);
  };

  const handleConfirm = async () => {
    if (!anticipo) return;
    if (motivo.trim().length < 3) {
      notifyWarning(undefined, {
        title: "Indica un motivo",
        description: "Escribe un motivo de al menos 3 caracteres para cancelar el anticipo.",
      });
      return;
    }
    await cancelar.mutateAsync({ id: anticipo.id, motivo: motivo.trim() });
    handleOpenChange(false);
  };

  if (!anticipo) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      icon={Ban}
      title="¿Cancelar este anticipo?"
      description={
        <>
          El anticipo de {anticipo.proveedor_nombre ?? "este proveedor"} quedará marcado como cancelado y ya no
          podrá aplicarse a facturas. Esta acción no se puede deshacer.
        </>
      }
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={cancelar.isPending}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={cancelar.isPending}
          >
            {cancelar.isPending ? "Cancelando…" : "Cancelar anticipo"}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="cancel-motivo">Motivo de cancelación</Label>
        <Textarea
          id="cancel-motivo"
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej. Registrado por error, duplicado…"
        />
      </div>
    </FormDialogShell>
  );
}
