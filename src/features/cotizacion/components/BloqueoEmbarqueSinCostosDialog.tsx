import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Lock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIrACargarCostos?: () => void;
}

/**
 * Diálogo de bloqueo cuando se intenta crear un embarque desde una cotización
 * que no tiene costos cargados en `cotizacion_costos`.
 */
export function BloqueoEmbarqueSinCostosDialog({ open, onOpenChange, onIrACargarCostos }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-destructive" aria-hidden />
            No se puede crear el embarque
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Esta cotización <strong>no tiene costos cargados</strong>. Para convertirla
              en embarque primero debes capturar el desglose de costos internos.
            </span>
            <span className="block text-xs text-muted-foreground">
              Esto protege el margen y evita embarques operando a ciegas.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {onIrACargarCostos && (
            <AlertDialogAction onClick={onIrACargarCostos}>
              Ir a cargar costos
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
