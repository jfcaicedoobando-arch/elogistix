/** Confirmación "Cancelar anticipo" (QW6). AlertDialog + motivo + RPC cancelar_anticipo_proveedor. */
import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este anticipo?</AlertDialogTitle>
          <AlertDialogDescription>
            El anticipo de {anticipo.proveedor_nombre ?? "este proveedor"} quedará marcado como cancelado y ya no
            podrá aplicarse a facturas. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelar.isPending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); void handleConfirm(); }}
            disabled={cancelar.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cancelar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {cancelar.isPending ? "Cancelando…" : "Cancelar anticipo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
