/**
 * Confirmación para alinear el T/C del embarque al DOF de su fecha.
 * Se separa del texto informativo para mantener baja la complejidad (Power of 10).
 */
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatFechaEs } from "@/lib/formatters";
import { useAlinearTcEmbarqueDof } from "@/features/embarques/hooks/useTcEmbarqueDof";
import { dialogSize } from "@/components/shared/utils/dialogTokens";

interface Props {
  embarqueId: string;
  /** Fecha (ISO) del DOF a aplicar: la de creación del embarque. */
  fecha: string;
  tcActual: number;
  tcDof: number;
}

export function PnlTcAlinearDialog({ embarqueId, fecha, tcActual, tcDof }: Props) {
  const alinear = useAlinearTcEmbarqueDof(embarqueId);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Alinear el tipo de cambio al DOF">
          Usar el del DOF
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={dialogSize.md}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Alinear el tipo de cambio al DOF?</AlertDialogTitle>
          <AlertDialogDescription>
            El T/C USD del embarque pasará de {tcActual.toFixed(4)} a {tcDof.toFixed(4)} (DOF del{" "}
            {formatFechaEs(fecha)}). Esto recalcula el P&L y todas las conversiones a pesos de este
            expediente. Queda registrado en la bitácora.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => alinear.mutate(fecha)} disabled={alinear.isPending}>
            Sí, usar el del DOF
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
