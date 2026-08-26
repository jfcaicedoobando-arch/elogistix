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
export { insertProveedoresLote } from "./importLote";
export {
  ProveedorDuplicadoError,
  findProveedorByRfcEnOrg,
} from "./duplicadoRfc";
export { fetchProveedorOperaciones } from "./operaciones";
