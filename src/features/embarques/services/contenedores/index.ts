/**
 * Barrel: servicios CRUD de embarque_contenedores.
 */
export {
  listarPorEmbarque,
  crearMuchos,
  reemplazarTodos,
  sincronizarContenedores,
} from "./crud";
export {
  fetchContenedoresInfoMap,
  type ContenedoresInfo,
  type ContenedoresInfoMap,
} from "./fetchInfoMap";
export { actualizarDemorasContenedor } from "./demoras";
export type { DemorasContenedorPatch } from "./demoras";

