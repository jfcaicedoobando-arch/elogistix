import { useMutationWithFeedback } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  fetchNavieras,
  insertNaviera,
  updateNaviera,
  setNavieraActivo,
  deleteNaviera,
  type Naviera,
} from "@/features/catalogos/services";
import { createCatalogHooks } from "@/hooks/shared/createCatalogHooks";

const hooks = createCatalogHooks<Naviera, { code: string; name: string }>({
  keys: { invalidate: queryKeys.navieras.all, active: queryKeys.navieras.activas, all: queryKeys.navieras.todas },
  fetch: fetchNavieras,
  insert: insertNaviera,
  setActivo: setNavieraActivo,
  remove: deleteNaviera,
  catalogo: "navieras",
  labels: {
    agregarSuccess: "Naviera agregada",
    agregarError: "Error al agregar naviera",
    toggleError: "Error al actualizar",
    eliminarSuccess: "Naviera eliminada",
    eliminarError: "Error al eliminar",
  },
});

/** Navieras activas ordenadas por nombre */
export const useNavieras = hooks.useList;
/** Todas las navieras (incluye inactivas) para admin */
export const useAllNavieras = hooks.useListAll;

export function useAdminNavieras() {
  const { agregar, toggleActivo, eliminar } = hooks.useAdmin();
  // Q-13: edición de código/nombre — la fábrica `createCatalogHooks` no cubre
  // update, así que se arma aquí con el mismo wrapper de feedback.
  const editar = useMutationWithFeedback({
    mutationFn: ({ id, code, name }: { id: string; code: string; name: string }) =>
      updateNaviera(id, { code, name }),
    invalidate: queryKeys.navieras.all,
    successTitle: "Naviera actualizada",
    errorTitle: "Error al actualizar naviera",
  });
  return { agregarNaviera: agregar, toggleActivo, eliminarNaviera: eliminar, editarNaviera: editar };
}
