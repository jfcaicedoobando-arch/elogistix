/**
 * Mutación de la Card "Cierre de periodo contable".
 *
 * Vive en `hooks/` porque la regla de arquitectura prohíbe `useMutation`
 * inline dentro de `components/`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { actualizarCierrePeriodo } from "@/features/configuracion/services/configuracionClaves";

interface Params {
  organizationId: string | null | undefined;
  motivo: string;
  onExito: () => void;
}

export function useActualizarCierrePeriodo({ organizationId, motivo, onExito }: Params) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nuevaFecha: string) => {
      if (!organizationId) {
        throw new Error("Selecciona una organización antes de guardar la configuración.");
      }
      return actualizarCierrePeriodo(organizationId, nuevaFecha || null, motivo || undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all });
      notifySuccess(undefined, { title: "Cierre de periodo actualizado" });
      onExito();
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "Error al guardar", description: getErrorMessage(error) });
    },
  });
}
