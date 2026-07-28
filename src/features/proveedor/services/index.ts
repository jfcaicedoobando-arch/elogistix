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
  
} from "./proveedoresCrud";
export {
  
  ProveedorDuplicadoError,
  findProveedorByRfcEnOrg,
} from "./duplicadoRfc";
export { fetchProveedorOperaciones } from "./operaciones";
