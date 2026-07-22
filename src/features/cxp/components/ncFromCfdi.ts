/**
 * Mapea un CFDI parseado a los valores iniciales de una nota de crédito de
 * proveedor. Mantiene `DialogNotaCreditoProveedor` dentro del límite Power of 10.
 */
import type { CfdiParsedResponse } from "@/features/cxp/services";

export interface NcPrefillValues {
  folio: string;
  fecha: string;
  monto: string;
  uuidFiscal: string;
  descripcion: string;
  tipoComprobante: string;
}

export function buildNcPrefillFromCfdi(data: CfdiParsedResponse): NcPrefillValues {
  const c = data.cfdi;
  const folio = `${c.serie ?? ""}${c.serie && c.folio ? "-" : ""}${c.folio ?? ""}`.trim() || c.uuid.slice(0, 8);
  return {
    folio,
    fecha: c.fecha,
    monto: c.total.toFixed(2),
    uuidFiscal: c.uuid,
    descripcion: data.ai?.notas?.trim() || c.conceptos?.[0]?.descripcion?.trim() || "",
    tipoComprobante: c.tipo_comprobante || "I",
  };
}
