import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function DoubleConfirmDeleteDialog({
  open,
  onOpenChange,
  entityName,
  description,
  finalDescription,
  onConfirm,
  isPending = false,
}: DoubleConfirmDeleteDialogProps) {
  return <DoubleConfirmInner
    open={open}
    onOpenChange={onOpenChange}
    entityName={entityName}
    description={description}
    finalDescription={finalDescription}
    onConfirm={onConfirm}
    isPending={isPending}
  />;
}

import { useState, useEffect } from "react";

function DoubleConfirmInner({
  open,
  onOpenChange,
  entityName,
  description,
  finalDescription,
  onConfirm,
  isPending,
}: DoubleConfirmDeleteDialogProps) {
  const [paso2, setPaso2] = useState(false);

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) setPaso2(false);
  }, [open]);

  const close = () => {
    setPaso2(false);
    onOpenChange(false);
  };

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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                await onConfirm();
                close();
              }}
              disabled={isPending}
            >
              {isPending ? "Eliminando..." : "Eliminar definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
