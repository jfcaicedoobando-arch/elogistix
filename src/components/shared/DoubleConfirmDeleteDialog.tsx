import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";

import type { ReactNode } from "react";

interface DoubleConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  /** First step description (string o ReactNode con <strong>, listas, spinners). */
  description?: ReactNode;
  /** Second step description (string o ReactNode). */
  finalDescription?: ReactNode;
  /** Contenido extra del paso 1 (p. ej. el grid financiero de una factura).
   *  Ola 3 · O3.1 — permite adoptar el patrón sin clonarlo cuando el diálogo
   *  necesita mostrar datos de la entidad antes de confirmar. */
  children?: ReactNode;
  /** Etiqueta del botón destructivo final. Default "Eliminar definitivamente". */
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
}

export default function DoubleConfirmDeleteDialog(props: DoubleConfirmDeleteDialogProps) {
  return <DoubleConfirmInner {...props} />;
}

import { useState, useEffect } from "react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";

function DoubleConfirmInner({
  open,
  onOpenChange,
  entityName,
  description,
  finalDescription,
  children,
  confirmLabel = "Eliminar definitivamente",
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
    // Defecto 1: mientras la eliminación está en curso NO se puede cerrar el
    // diálogo (Escape, clic exterior, Cancelar). Antes el usuario podía creer
    // que canceló una operación irreversible que seguía ejecutándose.
    if (isPending) return;
    setPaso2(false);
    setConfirmText("");
    onOpenChange(false);
  };

  const canDelete = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <>
      {/* Paso 1 */}
      <AlertDialog open={open && !paso2} onOpenChange={(v) => { if (!v) close(); }}>
        <AlertDialogContent className={dialogSize.sm}>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {entityName}?</AlertDialogTitle>
            {typeof description === "string" || !description ? (
              <AlertDialogDescription>
                {description || `Se eliminará ${entityName} de forma permanente.`}
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription asChild>
                <div className="text-body text-muted-foreground">{description}</div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          {children}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); setPaso2(true); }}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Paso 2 */}
      <AlertDialog open={paso2} onOpenChange={(v) => { if (!v) close(); }}>
        <AlertDialogContent
          className={dialogSize.sm}
          aria-busy={isPending}
          onEscapeKeyDown={(e) => { if (isPending) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (isPending) e.preventDefault(); }}
          onInteractOutside={(e) => { if (isPending) e.preventDefault(); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
              Confirmar eliminación
            </AlertDialogTitle>
            {typeof finalDescription === "string" || !finalDescription ? (
              <AlertDialogDescription>
                {finalDescription || "¿Estás completamente seguro? Esta acción no se puede deshacer."}
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription asChild>
                <div className="text-body text-muted-foreground">{finalDescription}</div>
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-delete" className="text-body text-muted-foreground">
              Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && canDelete && !isPending) {
                  e.preventDefault();
                  // N-EC-02: si `onConfirm` falla, NO cerramos (el usuario
                  // puede reintentar o cancelar) y no dejamos rejection suelto.
                  try {
                    await onConfirm();
                    close();
                  } catch (err) {
                    console.error("[DoubleConfirmDeleteDialog] onConfirm rechazó:", err);
                  }
                }
              }}
              placeholder="ELIMINAR"
              autoComplete="off"
              disabled={isPending}
              className="font-mono"
            />
          </div>
          {isPending && (
            <p role="status" aria-live="polite" className="text-body text-muted-foreground">
              Eliminando… no cierres esta ventana.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                // N-EC-02: mismo criterio que el Enter del input.
                try {
                  await onConfirm();
                  close();
                } catch (err) {
                  console.error("[DoubleConfirmDeleteDialog] onConfirm rechazó:", err);
                }
              }}
              disabled={isPending || !canDelete}
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Eliminando…</>
              ) : (
                confirmLabel
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
