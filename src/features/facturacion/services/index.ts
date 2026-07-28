/**
 * Barrel puro del feature `facturas/services`.
 * No contiene implementación (Auditoría Paso 2).
 */
export {
  fetchFacturasListado,
  fetchFacturas,
  marcarCostoPagado,
  fetchGastosPendientes,
} from "./facturasCrud";
export type { FacturaListItem } from "./facturasCrud";
export {
  fetchLayoutContableData,
  fetchEstadoCuentaFacturas,
} from "./exports";
export type { FilaHueco } from "./huecoFacturacion";
export { fetchHuecoFacturacion } from "./huecoFacturacion";
export { fetchProyeccionMes } from "./proyeccion";
export { fetchFacturasParaZip, marcarFacturasComoEnviadas } from "./masivas";
export {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
  fetchDefaultsFacturacionCliente,
  guardarDefaultsTimbradoCliente,
  guardarDefaultsCcCliente,
  guardarDefaultsDestinatariosCliente,
} from "./datosFiscalesCliente";
export type {
  ClienteFiscalRow,
  DatosTimbradoPatch,
  DefaultsFacturacionCliente,
} from "./datosFiscalesCliente";
export * from "./cobranza";
