/**
 * Barrel de vinculación CRM ↔ Cotización.
 *
 * v12.1.0: split desde `vincularCotizacion.ts` (202 líneas) en submódulos
 * para cumplir Power of 10. API pública sin cambios.
 */
;
export {
  vincularOCrearOportunidadParaCotizacion,
  
} from "./vincularOCrear";
export { sincronizarEtapaPorEstadoCotizacion } from "./sincronizarEtapa";
export { propagarConversionProspectoCRM } from "./propagarConversion";
