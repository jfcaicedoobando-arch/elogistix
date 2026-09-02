import { createCatalogHooks } from "@/hooks/shared/createCatalogHooks";
import { queryKeys } from "@/lib/query";
import {
  fetchTiposContenedor,
  insertTipoContenedor,
  setTipoContenedorActivo,
  deleteTipoContenedor,
  type TipoContenedor,
} from "@/features/catalogos/services";
import type { TipoContenedorCanonico } from "@/features/catalogos/utils/tiposContenedorCanonico";

export type { TipoContenedor };

const hooks = createCatalogHooks<TipoContenedorCanonico, { code: string; name: string }>({
  keys: {
    invalidate: queryKeys.tiposContenedor.all,
    active: queryKeys.tiposContenedor.activos,
    all: queryKeys.tiposContenedor.todos,
  },
  fetch: fetchTiposContenedor,
  insert: insertTipoContenedor,
  setActivo: setTipoContenedorActivo,
  remove: deleteTipoContenedor,
  catalogo: "tipos_contenedor",
  labels: {
    agregarSuccess: "Tipo de contenedor agregado",
    agregarError: "Error al agregar tipo",
    toggleError: "Error al actualizar",
    eliminarSuccess: "Tipo de contenedor eliminado",
    eliminarError: "Error al eliminar",
  },
});

/** Tipos de contenedor activos ordenados por nombre */
export const useTiposContenedor = hooks.useList;
/** Todos los tipos de contenedor (incluye inactivos) para admin */
export const useAllTiposContenedor = hooks.useListAll;

export function useAdminTiposContenedor() {
  const { agregar, toggleActivo, eliminar } = hooks.useAdmin();
  return { agregarTipo: agregar, toggleActivo, eliminarTipo: eliminar };
}
