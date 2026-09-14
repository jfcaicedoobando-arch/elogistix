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

// Validación SAT de facturas de proveedor (consumido por Compras).
export {
  motivoSatNoAplica,
  requiereValidacionSat,
  esValidableEnSat,
} from "./domain/validacionSat";
export type { FacturaValidacionSat } from "./domain/validacionSat";

// R1 (v13.823.390) — Tesorería necesita el saldo servidor de facturas de
// proveedor (canon `v_proveedor_facturas_saldo`) para la bandeja de pagos
// programados: se expone por el barrel en vez de un deep import cross-feature.
export { fetchSaldosProveedorFacturas } from "./services/saldosProveedorFactura";
export type { SaldoServidorCxP } from "./services/saldosProveedorFactura";

