/**
 * Bloqueo optimista del wizard de cotización (N-06, QA r2).
 *
 * Analogía: al abrir el expediente anotamos la hora de la última firma. Cada
 * vez que guardamos un paso mandamos esa hora: si alguien más firmó antes, el
 * guardado no se aplica y se avisa (LC_CONFLICTO_CONCURRENCIA). Tras cada
 * guardado propio la hora se refresca, así los pasos siguientes del mismo
 * usuario no se bloquean entre sí.
 *
 * v13.823.15: en una cotización NUEVA el sello arrancaba en `null`, pero la
 * base de datos sí firma la fila al crearla (`updated_at = created_at`). El
 * segundo guardado del mismo usuario comparaba "sin firma" contra la firma real
 * y fallaba con un conflicto falso. Ahora el sello se siembra con el
 * `updated_at` que devuelve el INSERT.
 */
import { useCallback, useRef } from "react";
import type { CreateCotizacionInput } from "@/features/cotizacion/types";

type UpdateVars = { id: string; data: Partial<CreateCotizacionInput> & Record<string, unknown> };

export interface UpdateCotizacionMutation {
  mutateAsync: (d: UpdateVars & { expectedUpdatedAt?: string | null }) => Promise<unknown>;
  isPending: boolean;
}

export interface CrearCotizacionMutation<TRow extends { id: string }> {
  mutateAsync: (d: CreateCotizacionInput) => Promise<TRow>;
  isPending: boolean;
}

export interface GuardedUpdateMutation {
  mutateAsync: (d: UpdateVars) => Promise<unknown>;
  isPending: boolean;
}

export interface CotizacionUpdateGuard<TRow extends { id: string }> {
  updateCotizacion: GuardedUpdateMutation;
  crearCotizacion: CrearCotizacionMutation<TRow>;
}

export function useCotizacionUpdateGuard<TRow extends { id: string; updated_at?: string | null }>(
  updateCotizacion: UpdateCotizacionMutation,
  initialUpdatedAt: string | null | undefined,
  crearCotizacion?: CrearCotizacionMutation<TRow>,
): GuardedUpdateMutation & { crearCotizacion?: CrearCotizacionMutation<TRow> } {
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

  const crearGuardado = useCallback(
    async (input: CreateCotizacionInput): Promise<TRow> => {
      // El INSERT no puede tener conflicto: sólo siembra el sello real de la
      // fila recién creada para los guardados siguientes del mismo usuario.
      const row = await (crearCotizacion as CrearCotizacionMutation<TRow>).mutateAsync(input);
      expectedRef.current = row?.updated_at ?? null;
      return row;
    },
    [crearCotizacion],
  );

  return {
    mutateAsync,
    isPending: updateCotizacion.isPending,
    ...(crearCotizacion
      ? { crearCotizacion: { mutateAsync: crearGuardado, isPending: crearCotizacion.isPending } }
      : {}),
  };
}
