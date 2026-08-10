/**
 * Parseo de conceptos del snapshot de emisión para sugerirlos en una Nota de
 * Crédito. Extraído de `FacturaNotasCreditoSeccion.tsx` para que ese archivo
 * exporte únicamente componentes (regla `react-refresh/only-export-components`).
 */
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import { TASA_IVA } from "@/lib/financial/financialUtils";

interface ConceptoSnapshot {
  descripcion?: string;
  concepto?: string;
  cantidad?: number;
  precio_unitario?: number;
  precio?: number;
  importe?: number;
  total?: number;
  /** Ola 4 · N19: régimen de IVA del concepto en el snapshot de emisión. */
  tipo_iva?: "gravado_16" | "tasa_0" | "exento" | null;
}

/**
 * Ola 4 · N19: propaga `tipo_iva` del snapshot a la NC para que timbre el mismo
 * régimen de IVA que el CFDI relacionado.
 */
export function parseConceptosSugeridos(snapshot: unknown): ConceptoNotaCredito[] {
  if (typeof snapshot !== "object" || snapshot === null) return [];
  const list = (snapshot as { conceptos?: unknown }).conceptos;
  if (!Array.isArray(list)) return [];
  return (list as ConceptoSnapshot[]).map((c) => ({
    descripcion: c.descripcion ?? c.concepto ?? "",
    cantidad: Number(c.cantidad ?? 1),
    precio_unitario: Number(c.precio_unitario ?? c.precio ?? c.importe ?? 0),
    clave_sat: "84111506",
    clave_unidad: "E48",
    unidad: "Unidad de servicio",
    tasa_iva: TASA_IVA,
    // Ola 4 · N19: propagar el régimen de IVA del concepto original.
    tipo_iva: c.tipo_iva ?? null,
  })).filter((c) => c.descripcion);
}
