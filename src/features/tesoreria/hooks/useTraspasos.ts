/**
 * Hooks para traspasos entre cuentas propias de banco.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  registrarTraspaso,
  type RegistrarTraspasoInput,
} from "@/features/tesoreria/services/traspasos";

export function useRegistrarTraspaso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegistrarTraspasoInput) =>
      registrarTraspaso({ ...input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Traspaso registrado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al registrar traspaso: ${error.message}`,
        error,
        method: "REGISTRAR_TRASPASO",
      });
    },
  });
}
