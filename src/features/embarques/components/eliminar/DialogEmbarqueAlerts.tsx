import { dialogSize } from "@/components/shared/utils/dialogTokens";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmbarqueDependenciasFinancieras } from "@/features/embarques/hooks";
import { Ban, Loader2 } from "lucide-react";
import DialogEliminarEmbarqueBloqueado from "../DialogEliminarEmbarqueBloqueado";

/**
 * Diálogo puramente informativo mostrado cuando el embarque no se puede
 * eliminar (client-side check o `EmbarqueBloqueadoError` del server).
 * Se aisla del componente principal para bajar la ciclomática del render
 * canónico (v13.301.74a).
 */
export function DialogEmbarqueBloqueadoAlert({
  open,
  expediente,
  deps,
  onClose,
}: {
  open: boolean;
  expediente: string;
  deps: EmbarqueDependenciasFinancieras;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" aria-hidden />
            No se puede eliminar el embarque
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <DialogEliminarEmbarqueBloqueado expediente={expediente} deps={deps} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Entendido</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Placeholder mostrado mientras la query de dependencias resuelve o falla,
 * para que el usuario no vea el doble-confirm antes de tiempo.
 */
export function DialogEmbarqueVerificandoAlert({
  open,
  isLoading,
  hasError,
  onClose,
}: {
  open: boolean;
  isLoading: boolean;
  hasError: boolean;
  onClose: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle>Verificando dependencias…</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm">
              {isLoading && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  Verificando documentos financieros asociados…
                </p>
              )}
              {hasError && (
                <p className="text-destructive">
                  No se pudo verificar dependencias financieras. Intenta nuevamente.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Cerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
