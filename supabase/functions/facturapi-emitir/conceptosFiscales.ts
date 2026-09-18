/**
 * Clasificación fiscal por renglón de `conceptos_factura` antes de timbrar.
 * Extraído de `contexto.ts` para respetar el límite de líneas por archivo.
 */
import { jsonResponse } from "../_shared/response.ts";
import { clasificarCoherenciaIva, mensajeCoherenciaIva } from "../_shared/coherenciaIva.ts";
import type { FacturaContext } from "./helpers.ts";

/**
 * Renglón de `conceptos_factura`.
 *
 * OJO: esta tabla NO tiene `aplica_iva` — ese interruptor legado sólo existe en
 * `conceptos_venta` y `proforma_conceptos_consolidados`. Aquí el tratamiento
 * SAT se determina con `tipo_iva` (canónico) + `tasa_iva_aplicada`, y sus
 * contradicciones ya bloquean el timbrado. No volver a pedirlo en el select:
 * PostgREST responde 400 y el timbrado muere con `conceptos_query_failed`.
 */
export interface ConceptoRow {
  descripcion: string; cantidad: number | string; precio_unitario: number | string;
  clave_sat?: string | null; clave_unidad?: string | null; tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null; tasa_ret_isr?: number | string | null; tasa_ret_iva?: number | string | null;
}

/**
 * P1-IVA: la clasificación fiscal del renglón NO se completa con un 16% por
 * omisión. Si el tratamiento explícito y la tasa se contradicen (o el renglón
 * legado es ambiguo), se bloquea el timbrado con un mensaje accionable en vez
 * de emitir un importe distinto al aprobado.
 */
export function resolverConceptosFiscales(conceptos: ConceptoRow[]): FacturaContext["conceptos"] | Response {
  const bloqueos: string[] = [];
  const resueltos = conceptos.map((c) => {
    const clasif = clasificarCoherenciaIva({
      tipo_iva: c.tipo_iva ?? null,
      tasa_iva_aplicada: c.tasa_iva_aplicada ?? null,
    });
    if (clasif.estado !== "ok") bloqueos.push(mensajeCoherenciaIva(c.descripcion, clasif));
    return {
      descripcion: c.descripcion, cantidad: Number(c.cantidad), precio_unitario: Number(c.precio_unitario), clave_sat: c.clave_sat,
      clave_unidad: c.clave_unidad ?? "E48", unidad: "Unidad de servicio",
      tipo_iva: clasif.tipo,
      tasa_iva: clasif.tasa,
      tasa_ret_isr: c.tasa_ret_isr != null ? Number(c.tasa_ret_isr) : 0,
      tasa_ret_iva: c.tasa_ret_iva != null ? Number(c.tasa_ret_iva) : 0,
    };
  });
  if (bloqueos.length > 0) {
    return jsonResponse({ error: "tipo_iva_indeterminado", message: bloqueos.join(" "), issues: bloqueos }, 422);
  }
  return resueltos;
}
