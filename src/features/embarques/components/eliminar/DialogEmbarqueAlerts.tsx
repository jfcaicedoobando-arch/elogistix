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
  onRetry,
}: {
  open: boolean;
  expediente: string;
  deps: EmbarqueDependenciasFinancieras;
  onClose: () => void;
  onRetry: () => void;
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
          <AlertDialogAction onClick={(event) => { event.preventDefault(); onRetry(); }}>Volver a verificar</AlertDialogAction>
          <AlertDialogAction onClick={onClose}>Cerrar</AlertDialogAction>
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
  onRetry,
  errorMessage,
}: {
  open: boolean;
  isLoading: boolean;
  hasError: boolean;
  onClose: () => void;
  onRetry?: () => void;
  errorMessage?: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent className={dialogSize.sm}>
        <AlertDialogHeader>
          <AlertDialogTitle>Verificación de dependencias</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-body">
              {isLoading && (
                <p role="status" aria-live="polite" className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Verificando documentos financieros asociados…
                </p>
              )}
              {hasError && (
                <p role="alert" className="text-destructive">
                  {errorMessage ?? "No pudimos completar la verificación. Vuelve a verificar antes de intentar eliminar el embarque. Si el problema continúa, comparte el expediente con Contabilidad."}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {hasError && onRetry && <AlertDialogAction onClick={(event) => { event.preventDefault(); onRetry(); }}>Volver a verificar</AlertDialogAction>}
          <AlertDialogAction onClick={onClose}>Cerrar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
