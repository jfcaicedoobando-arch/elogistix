/**
 * P2-IVA — Lectura del tratamiento fiscal declarado por el proveedor en cada
 * línea del CFDI. Es SÓLO informativo: no se infiere nada ni se modifica ningún
 * cálculo. Si el XML no trae el dato, se dice "No declarado" en vez de suponer.
 */
import type { CfdiConceptoParsed } from "@/features/cxp/services";

export const AVISO_CFDI_SOLO_IMPORTES =
  "Del XML sólo se guarda el importe de impuestos por línea. La base, el factor, " +
  "la tasa/cuota y el ObjetoImp se muestran aquí para revisión, pero no se " +
  "almacenan por separado: el XML original queda archivado como respaldo.";

/** Etiqueta corta para la columna de tratamiento fiscal. */
export function etiquetaTratamientoLinea(c: CfdiConceptoParsed): string {
  if (c.objeto_imp === "01") return "No objeto (01)";
  const iva = (c.traslados ?? []).filter((t) => t.impuesto === "002");
  if (iva.length === 0) return c.objeto_imp ? "Sin traslado de IVA" : "No declarado";
  const exento = iva.some((t) => t.tipo_factor === "Exento");
  const tasas = Array.from(
    new Set(iva.filter((t) => t.tasa_o_cuota != null).map((t) => Number(t.tasa_o_cuota))),
  );
  const partes = tasas.map((t) => `${(t * 100).toFixed(t * 100 % 1 === 0 ? 0 : 2)}%`);
  if (exento) partes.push("Exento");
  return partes.length > 0 ? partes.join(" + ") : "Sin tasa declarada";
}

/** Detalle largo (tooltip): base, factor, tasa/cuota e importe por traslado. */
export function detalleTratamientoLinea(c: CfdiConceptoParsed): string {
  const traslados = c.traslados ?? [];
  const objeto = c.objeto_imp ? `ObjetoImp ${c.objeto_imp}` : "ObjetoImp no declarado";
  if (traslados.length === 0) return `${objeto} · sin traslados en el XML`;
  const filas = traslados.map((t) => {
    const tasa = t.tasa_o_cuota == null ? "sin tasa" : String(t.tasa_o_cuota);
    return `${t.impuesto === "002" ? "IVA" : t.impuesto === "003" ? "IEPS" : t.impuesto}: base ${t.base}, factor ${t.tipo_factor || "n/d"}, tasa/cuota ${tasa}, importe ${t.importe}`;
  });
  return `${objeto} · ${filas.join(" · ")}`;
}
