/**
 * Catálogo de tratamientos de IVA para renglones de factura (constantes y
 * reglas puras, sin componentes: así `FacturaTipoIvaSelect.tsx` sólo exporta
 * el componente y el fast refresh no se queja).
 */
import { puedeGuardarTipoIva } from "@/lib/financial/ivaFrontera";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

export const TIPO_IVA_LABEL: Record<TipoIvaConcepto, string> = {
  gravado_16: "IVA 16%",
  gravado_8: "IVA 8% (frontera)",
  tasa_0: "Tasa 0%",
  exento: "Exento",
  no_objeto: "No objeto de impuesto (SAT 01)",
};

export const ORDEN_TIPOS_IVA: readonly TipoIvaConcepto[] = [
  "gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto",
];

/** `true` cuando el tratamiento elegido no puede guardarse (8% deshabilitado). */
export function frontera8Bloqueado(
  tipo: TipoIvaConcepto | undefined,
  tipoOriginal: TipoIvaConcepto | null | undefined,
  fronteraHabilitada: boolean,
): boolean {
  if (!tipo) return false;
  return !puedeGuardarTipoIva(tipo, tipoOriginal, fronteraHabilitada);
}
