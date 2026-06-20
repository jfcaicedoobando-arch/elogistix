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
export type {
  FacturaRow,
  FacturaListItem,
  FacturasListadoFilters,
  FacturasListadoResult,
} from "./facturasCrud";
export {
  fetchLayoutContableData,
  fetchEstadoCuentaFacturas,
} from "./exports";
export type {
  LayoutContableData,
  LayoutContableRow,
  EstadoCuentaFactura,
} from "./exports";
export type { FilaHueco, HuecoFacturacionResult } from "./huecoFacturacion";
export { fetchHuecoFacturacion } from "./huecoFacturacion";
export { fetchProyeccionMes } from "./proyeccion";
export type { ProyeccionMesParams } from "./proyeccion";
export { fetchFacturasParaZip, marcarFacturasComoEnviadas } from "./masivas";
export type { FacturaParaZip } from "./masivas";
export {
  fetchClienteFiscal,
  actualizarDatosTimbradoFactura,
} from "./datosFiscalesCliente";
export type { ClienteFiscalRow, DatosTimbradoPatch } from "./datosFiscalesCliente";
export * from "./cobranza";
