/**
 * createCatalogHooks — factory que colapsa el patrón repetido en los catálogos
 * simples (navieras, puertos, tipos_contenedor):
 *   - `useList()`     → lista de activos con staleTime alto (30 min)
 *   - `useListAll()`  → lista completa (incluye inactivos) para vistas admin
 *   - `useAdmin()`    → mutations `agregar`, `toggleActivo`, `eliminar`
 *
 * Cada catálogo pasaba ~55 líneas duplicadas; con esta fábrica quedan ~15.
 *
 * Analogía: en vez de armar el mismo mueble tres veces con las mismas piezas,
 * tenemos un "kit" y cambiamos sólo las etiquetas.
 */
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useMutationWithFeedback } from "@/hooks/shared";
import { registrarActividad } from "@/services/bitacora/registrar";

const HALF_HOUR = 30 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

export interface CatalogHooksConfig<TRow, TInsert> {
  /** Query keys: `invalidate` engloba el resto; `active` y `all` son variantes. */
  keys: { invalidate: QueryKey; active: QueryKey; all: QueryKey };
  /** Fetcher; recibe `incluirInactivos` (para diferenciar activos vs todos). */
  fetch: (incluirInactivos: boolean) => Promise<TRow[]>;
  insert: (input: TInsert) => Promise<unknown>;
  setActivo: (id: string, activo: boolean) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /**
   * v13.453.0 — Nombre del catálogo (ej. `navieras`) para registrar cada
   * alta/baja/activación en la bitácora del sistema (módulo `catalogos`).
   */
  catalogo?: string;
  /** Textos de toast; el hook admin los usa para success/error. */
  labels: {
    agregarSuccess: string;
    agregarError: string;
    toggleError: string;
    eliminarSuccess: string;
    eliminarError: string;
  };
}

export function createCatalogHooks<TRow, TInsert>(cfg: CatalogHooksConfig<TRow, TInsert>) {
  const useList = () =>
    useQuery<TRow[]>({
      queryKey: cfg.keys.active,
      queryFn: () => cfg.fetch(false),
      staleTime: HALF_HOUR,
    });

  const useListAll = () =>
    useQuery<TRow[]>({
      queryKey: cfg.keys.all,
      queryFn: () => cfg.fetch(true),
      staleTime: ONE_MINUTE,
    });

  const useAdmin = () => {
    const invalidate = cfg.keys.invalidate;
    const agregar = useMutationWithFeedback({
      mutationFn: (input: TInsert) => cfg.insert(input),
      invalidate,
      successTitle: cfg.labels.agregarSuccess,
      errorTitle: cfg.labels.agregarError,
    });
    const toggleActivo = useMutationWithFeedback({
      mutationFn: ({ id, activo }: { id: string; activo: boolean }) => cfg.setActivo(id, activo),
      invalidate,
      errorTitle: cfg.labels.toggleError,
    });
    const eliminar = useMutationWithFeedback({
      mutationFn: (id: string) => cfg.remove(id),
      invalidate,
      successTitle: cfg.labels.eliminarSuccess,
      errorTitle: cfg.labels.eliminarError,
    });
    return { agregar, toggleActivo, eliminar };
  };

  return { useList, useListAll, useAdmin };
}
