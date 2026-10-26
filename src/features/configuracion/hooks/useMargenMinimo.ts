/**
 * Margen mínimo de utilidad estimada de la organización activa (default 8%).
 * Reutilizable en embarques y, más adelante, en cotizaciones.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { guardarMargenMinimo } from "../services/margenMinimo";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import { useConfigValue } from "./useConfiguracion";
import {
  MARGEN_MINIMO_CATEGORIA, MARGEN_MINIMO_CLAVE, MARGEN_MINIMO_DEFAULT_PCT, normalizarMargenMinimo,
} from "@/lib/domain/margenMinimo";

export function useMargenMinimo(): number {
  const valor = useConfigValue<unknown>(MARGEN_MINIMO_CATEGORIA, MARGEN_MINIMO_CLAVE, MARGEN_MINIMO_DEFAULT_PCT);
  return normalizarMargenMinimo(valor);
}

export function useGuardarMargenMinimo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: guardarMargenMinimo,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.configuracion.all }),
    onSuccess: () => notifySuccess(undefined, { title: "Margen mínimo guardado" }),
    onError: (error: Error) =>
      notifyError(undefined, { title: "No se pudo guardar", description: getErrorMessage(error), error, method: "SET_MARGEN_MINIMO" }),
  });
}
