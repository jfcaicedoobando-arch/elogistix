import { createCatalogHooks } from "@/hooks/shared/createCatalogHooks";
import { queryKeys } from "@/lib/query";
import {
  fetchPuertos,
  insertPuerto,
  setPuertoActivo,
  deletePuerto,
  type Puerto,
} from "@/features/catalogos/services";

;

const hooks = createCatalogHooks<Puerto, { code: string; name: string; country: string }>({
  keys: { invalidate: queryKeys.puertos.all, active: queryKeys.puertos.activos, all: queryKeys.puertos.todos },
  fetch: fetchPuertos,
  insert: insertPuerto,
  setActivo: setPuertoActivo,
  remove: deletePuerto,
  labels: {
    agregarSuccess: "Puerto agregado",
    agregarError: "Error al agregar puerto",
    toggleError: "Error al actualizar",
    eliminarSuccess: "Puerto eliminado",
    eliminarError: "Error al eliminar",
  },
});

/** Puertos activos ordenados por país → nombre */
export const usePuertos = hooks.useList;
/** Todos los puertos (incluye inactivos) para admin */
export const useAllPuertos = hooks.useListAll;

export function useAdminPuertos() {
  const { agregar, toggleActivo, eliminar } = hooks.useAdmin();
  return { agregarPuerto: agregar, toggleActivo, eliminarPuerto: eliminar };
}
