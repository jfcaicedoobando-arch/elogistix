/**
 * Espejo en pantalla de los obligatorios de `crm_enviar_solicitud_pricing`
 * (la base decide). Opcionales: notas, delivery, fecha tentativa y adjuntos.
 */
import type { SolicitudPricingRow } from "./tiposPricing";

type Datos = Partial<Pick<SolicitudPricingRow,
  "solicitante_id" | "fecha" | "cliente" | "servicio" | "tipo_operacion" | "incoterm" | "sector_economico" | "imo"
  | "commodity" | "tipo_carga" | "cantidad" | "estibable" | "peso" | "unidad_medida" | "dimensiones"
  | "origen" | "pol" | "destino" | "pod">>;

const OBLIGATORIOS: Array<[keyof Datos, string]> = [
  ["solicitante_id", "Solicitante"], ["fecha", "Fecha"], ["cliente", "Cliente"], ["servicio", "Modo de transporte"],
  ["tipo_operacion", "Tipo de operación"], ["incoterm", "Incoterm"], ["sector_economico", "Sector económico"],
  ["imo", "IMO"], ["commodity", "Commodity"], ["tipo_carga", "Tipo de contenedor"], ["cantidad", "Cantidad"],
  ["estibable", "Estibable"], ["peso", "Peso"], ["unidad_medida", "Unidad de medida"], ["dimensiones", "Dimensiones"],
  ["origen", "País de origen"], ["pol", "Puerto de origen"], ["destino", "País de destino"], ["pod", "Puerto de destino"],
];

export function camposFaltantesSolicitud(d: Datos): string[] {
  return OBLIGATORIOS.filter(([k]) => {
    const v = d[k];
    return v == null || (typeof v === "string" && v.trim() === "");
  }).map(([, etiqueta]) => etiqueta);
}
