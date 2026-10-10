import type { TopTarifaRow } from "@/features/costeo/types";
import { INCOTERMS } from "@/constants/wizardConstants";

export interface MetadataRespuestaPricing {
  incoterm: string | null;
  cantidad: number | null;
  servicio: string | null;
  tipo_carga: string | null;
}

/** Rechaza una respuesta no representable antes de cambiar la captura. */
export function validarIncotermRespuestaPricing(metadata?: MetadataRespuestaPricing | null) {
  const valor = metadata?.incoterm?.trim().toUpperCase();
  if (!valor) return null;
  const incoterm = INCOTERMS.find((i) => i === valor);
  if (!incoterm) {
    throw new Error(`El Incoterm ${valor} de Pricing no está disponible en cotizaciones. No se aplicó la respuesta; revisa el catálogo de Incoterms.`);
  }
  return incoterm;
}

/** No convierte carga genérica a contenedores ni cambia FCL/LCL. */
export function cantidadContenedoresPricing(metadata: MetadataRespuestaPricing, tarifa: TopTarifaRow, tipoEmbarque: string) {
  const coincideContenedor = Boolean(tarifa.tipo_contenedor_id) && Boolean(metadata.tipo_carga?.trim())
    && metadata.tipo_carga?.trim() === tarifa.tipo_contenedor_nombre?.trim()
    && !/LCL/i.test(metadata.tipo_carga ?? "");
  if (tipoEmbarque !== "FCL" || metadata.servicio !== "Marítimo" || !coincideContenedor) return null;
  const cantidad = metadata.cantidad;
  return cantidad != null && Number.isInteger(cantidad) && cantidad > 0 ? cantidad : null;
}

