/**
 * Superficie pública del feature CxP para otras features (Bloque 2.3).
 * v13.366.0 — El buzón (`bandejas`) captura la factura con este diálogo.
 */
export { DialogNuevaFacturaProveedor } from "./components/DialogNuevaFacturaProveedor";
export { DialogPagoLoteProveedor } from "./components/DialogPagoLoteProveedor";
export type { OrigenProveedor } from "./components/pagoProveedorHelpers";
export * from "./components/ProveedorCombobox";
export * from "./components/cxpColumns";
export * from "./components/DialogDetallePagosProveedor.parts";

// v13.821.2 — El tab Costos de embarques necesita el error/ubicación de
// documento duplicado del buzón: se expone por el barrel en vez de deep import.
export {
  BuzonDuplicadoError,
  CODIGO_BUZON_DUPLICADO,
  mensajeDuplicadoBuzon,
  localizarDuplicadoBuzon,
} from "./services/buzonDuplicado";
export type { CasoDuplicadoBuzon, UbicacionDuplicadoBuzon } from "./services/buzonDuplicado";
