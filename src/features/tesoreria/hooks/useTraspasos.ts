/**
 * Hooks para traspasos entre cuentas propias de banco.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import {
  registrarTraspaso, cancelarTraspaso, listarTraspasos,
  type RegistrarTraspasoInput,
} from "@/features/tesoreria/services/traspasos";

export function useTraspasos() {
  return useQuery({
    queryKey: queryKeys.tesoreria.all,
    queryFn: listarTraspasos,
    staleTime: 60_000,
  });
}

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

export function useCancelarTraspaso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      cancelarTraspaso(id, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Traspaso cancelado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al cancelar traspaso: ${error.message}`,
        error,
        method: "CANCELAR_TRASPASO",
      });
    },
  });
}

