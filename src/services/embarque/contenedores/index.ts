/**
 * Barrel: servicios CRUD de embarque_contenedores.
 */
export {
  listarPorEmbarque,
  crear,
  crearMuchos,
  actualizar,
  eliminar,
  reemplazarTodos,
  sincronizarContenedores,
} from "./crud";
export {
  fetchContenedoresInfoMap,
  type ContenedoresInfo,
  type ContenedoresInfoMap,
} from "./fetchInfoMap";

