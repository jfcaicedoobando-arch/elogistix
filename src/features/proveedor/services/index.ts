/**
 * Barrel puro del feature `proveedor/services`.
 * No contiene implementación (Auditoría Paso 2).
 */
export {
  fetchProveedoresPaginados,
  fetchProveedoresLite,
  findProveedorByRfc,
  fetchProveedor,
  insertProveedor,
  updateProveedor,
  deleteProveedor,
} from "./proveedoresCrud";
export type {
  Proveedor,
  ProveedorListItem,
  ProveedorOperacion,
  ProveedorLite,
  FetchProveedoresParams,
} from "./proveedoresCrud";
export {
  RFC_GENERICOS_SAT,
  ProveedorDuplicadoError,
  findProveedorByRfcEnOrg,
} from "./duplicadoRfc";
export { fetchProveedorOperaciones } from "./operaciones";
