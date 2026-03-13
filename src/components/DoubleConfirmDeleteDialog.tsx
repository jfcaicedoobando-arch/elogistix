import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface DoubleConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  /** First step description (e.g. "El embarque X será eliminado permanentemente.") */
  description?: string;
  /** Second step description */
  finalDescription?: string;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}

export default function DoubleConfirmDeleteDialog(props: DoubleConfirmDeleteDialogProps) {
  return <DoubleConfirmInner {...props} />;
}

import { useState, useEffect } from "react";

function DoubleConfirmInner({
  open,
  onOpenChange,
  entityName,
  description,
  finalDescription,
  onConfirm,
  isPending = false,
}: DoubleConfirmDeleteDialogProps) {
  const [paso2, setPaso2] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Reset step and text when dialog closes
  useEffect(() => {
    if (!open) {
      setPaso2(false);
      setConfirmText("");
    }
  }, [open]);

  const close = () => {
    setPaso2(false);
    setConfirmText("");
    onOpenChange(false);
  };

  const canDelete = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <>
      {/* Paso 1 */}
      <AlertDialog open={open && !paso2} onOpenChange={(v) => { if (!v) close(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {entityName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {description || `Se eliminará ${entityName} de forma permanente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setPaso2(true)}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2 */}
      <AlertDialog open={paso2} onOpenChange={(v) => { if (!v) close(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              {finalDescription || "¿Estás completamente seguro? Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
              Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ELIMINAR"
              autoComplete="off"
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await onConfirm();
                close();
              }}
              disabled={isPending || !canDelete}
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando...</>
              ) : (
                "Eliminar definitivamente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
