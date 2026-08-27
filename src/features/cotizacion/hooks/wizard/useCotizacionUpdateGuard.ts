/**
 * Bloqueo optimista del wizard de cotización (N-06, QA r2).
 *
 * Analogía: al abrir el expediente anotamos la hora de la última firma. Cada
 * vez que guardamos un paso mandamos esa hora: si alguien más firmó antes, el
 * guardado no se aplica y se avisa (LC_CONFLICTO_CONCURRENCIA). Tras cada
 * guardado propio la hora se refresca, así los pasos siguientes del mismo
 * usuario no se bloquean entre sí.
 */
import { useCallback, useRef } from "react";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";

type UpdateVars = { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> };

export interface UpdateCotizacionMutation {
  mutateAsync: (d: UpdateVars & { expectedUpdatedAt?: string | null }) => Promise<unknown>;
  isPending: boolean;
}

export interface GuardedUpdateMutation {
  mutateAsync: (d: UpdateVars) => Promise<void>;
  isPending: boolean;
}

export function useCotizacionUpdateGuard(
  updateCotizacion: UpdateCotizacionMutation,
  initialUpdatedAt: string | null | undefined,
): GuardedUpdateMutation {
  const expectedRef = useRef<string | null>(initialUpdatedAt ?? null);

  const mutateAsync = useCallback(
    async (vars: UpdateVars): Promise<void> => {
      const nuevo = await updateCotizacion.mutateAsync({
        ...vars,
        expectedUpdatedAt: expectedRef.current,
      });
      if (typeof nuevo === "string") expectedRef.current = nuevo;
    },
    [updateCotizacion],
  );

  return { mutateAsync, isPending: updateCotizacion.isPending };
}
