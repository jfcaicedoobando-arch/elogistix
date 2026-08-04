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
export type { ProveedorListItem } from "./proveedoresCrud";
export {
  ProveedorDuplicadoError,
  findProveedorByRfcEnOrg,
} from "./duplicadoRfc";
export { fetchProveedorOperaciones } from "./operaciones";
export {
  normalizarNombreProveedor,
  buscarProveedorPorNombreEnOrg,
  registrarAliasProveedor,
} from "./matchProveedorPorNombre";
export type { ProveedorMatch, MatchOrigen } from "./matchProveedorPorNombre";
