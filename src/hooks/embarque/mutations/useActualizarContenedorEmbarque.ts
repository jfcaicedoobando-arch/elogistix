/**
 * Hook para actualizar el contenedor seleccionado del embarque y disparar
 * la sincronización con JSONCargo en una sola operación.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarContenedorEmbarque } from "@/services/embarque/contenedor";
import { queryKeys } from "@/lib/query";

interface Input {
  embarqueId: string;
  contenedor: string;
}

export function useActualizarContenedorEmbarque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ embarqueId, contenedor }: Input) =>
      actualizarContenedorEmbarque(embarqueId, contenedor),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.embarques.detail(vars.embarqueId) });
    },
  });
}
