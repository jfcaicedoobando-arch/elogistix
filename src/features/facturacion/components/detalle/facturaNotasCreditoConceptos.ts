/**
 * Parseo de conceptos del snapshot de emisión para sugerirlos en una Nota de
 * Crédito. Extraído de `FacturaNotasCreditoSeccion.tsx` para que ese archivo
 * exporte únicamente componentes (regla `react-refresh/only-export-components`).
 *
 * P1-IVA — la NC debe reversar el MISMO tratamiento fiscal de cada renglón de
 * la factura: se copian `tipo_iva` (los cinco tratamientos, incluido no objeto
 * SAT 01 y el 8% de frontera), la tasa realmente aplicada y las retenciones
 * ISR/IVA. Nada se infiere: un renglón sin tratamiento reconocido llega con
 * `tipo_iva: null` y el borrador bloquea la emisión con un aviso.
 */
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { esTratamientoNC } from "@/features/facturacion/utils/impuestosNotaCredito";

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
  clave_sat?: string | null;
  clave_unidad?: string | null;
  unidad?: string | null;
  /** Régimen de IVA del concepto en el snapshot de emisión. */
  tipo_iva?: string | null;
  /** Tasa realmente aplicada al renglón (`conceptos_factura.tasa_iva_aplicada`). */
  tasa_iva_aplicada?: number | string | null;
  tasa_iva?: number | string | null;
  tasa_ret_isr?: number | string | null;
  tasa_ret_iva?: number | string | null;
}

function numeroOpcional(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseConceptosSugeridos(snapshot: unknown): ConceptoNotaCredito[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const list = (snapshot as { conceptos?: unknown }).conceptos;
  if (!Array.isArray(list)) return [];
  return (list as ConceptoSnapshot[]).map((c) => ({
    descripcion: c.descripcion ?? c.concepto ?? "",
    cantidad: Number(c.cantidad ?? 1),
    precio_unitario: Number(c.precio_unitario ?? c.precio ?? c.importe ?? 0),
    clave_sat: c.clave_sat ?? "84111506",
    clave_unidad: c.clave_unidad ?? "E48",
    unidad: c.unidad ?? "Unidad de servicio",
    // La tasa del renglón original, no la tasa global de la organización.
    tasa_iva: numeroOpcional(c.tasa_iva_aplicada ?? c.tasa_iva),
    tipo_iva: esTratamientoNC(c.tipo_iva) ? c.tipo_iva : null,
    tasa_ret_isr: numeroOpcional(c.tasa_ret_isr) ?? 0,
    tasa_ret_iva: numeroOpcional(c.tasa_ret_iva) ?? 0,
  })).filter((c) => c.descripcion);
}
