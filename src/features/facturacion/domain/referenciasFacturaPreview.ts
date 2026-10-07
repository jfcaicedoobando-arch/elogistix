/** Vista informativa de las referencias; nunca forma parte del payload fiscal. */
export interface ReferenciasEmbarqueFactura {
  expediente: string | null;
  bl_master: string | null;
  bl_house: string | null;
}

export interface FacturaReferenciasInput {
  id?: string;
  organization_id?: string | null;
  embarque_id?: string | null;
  expediente?: string | null;
  referencia_bl?: string | null;
}

export interface ConceptoReferenciaPreview {
  id: string;
  descripcion: string;
  referencias: ReferenciasEmbarqueFactura | null;
  /** No disponible no equivale a ausencia confirmada de referencias. */
  estado: "verificado" | "sin_origen" | "no_disponible";
}

export interface ReferenciasFacturaPreview {
  modo: "por_concepto" | "cabecera_legada";
  conceptos: ConceptoReferenciaPreview[];
}

export function computeReferenciasFallback(factura: FacturaReferenciasInput | null | undefined): ReferenciasEmbarqueFactura {
  return {
    expediente: factura?.expediente ?? null,
    bl_master: null,
    bl_house: factura?.referencia_bl ?? null,
  };
}

export function hasAlgunaReferencia(ref: ReferenciasEmbarqueFactura | null | undefined): boolean {
  return Boolean(ref?.expediente?.trim() || ref?.bl_master?.trim() || ref?.bl_house?.trim());
}

/** Mismo formato descriptivo de _shared/referenciasEmbarque.ts (sin Carta Porte). */
export function formatearPrefijoReferencias(ref: ReferenciasEmbarqueFactura | null | undefined): string {
  if (!hasAlgunaReferencia(ref)) return "";
  const parts: string[] = [];
  if (ref?.expediente?.trim()) parts.push(`Exp. ${ref.expediente.trim()}`);
  if (ref?.bl_master?.trim()) parts.push(`BL/M: ${ref.bl_master.trim()}`);
  if (ref?.bl_house?.trim()) parts.push(`BL/H: ${ref.bl_house.trim()}`);
  return `[${parts.join(" · ")}] `;
}

interface ConceptoOrigen { id: string; descripcion: string; embarque_id: string | null }
interface EmbarqueReferencia extends ReferenciasEmbarqueFactura { id: string }

/** Respeta el fallback legado únicamente cuando NINGÚN renglón tiene origen. */
export function resolverReferenciasPreview(
  factura: FacturaReferenciasInput,
  conceptos: ConceptoOrigen[],
  embarques: EmbarqueReferencia[],
): ReferenciasFacturaPreview {
  const porId = new Map(embarques.map((e) => [e.id, e]));
  const porConcepto = conceptos.some((c) => Boolean(c.embarque_id));
  const fallback = computeReferenciasFallback(factura);
  const cabecera = factura.embarque_id ? porId.get(factura.embarque_id) : null;
  const referenciasLegadas = cabecera ? {
    expediente: cabecera.expediente ?? fallback.expediente,
    bl_master: cabecera.bl_master ?? null,
    bl_house: cabecera.bl_house ?? fallback.bl_house,
  } : fallback;
  return {
    modo: porConcepto ? "por_concepto" : "cabecera_legada",
    conceptos: conceptos.map((c): ConceptoReferenciaPreview => {
      if (!porConcepto) return {
        id: c.id, descripcion: c.descripcion,
        estado: factura.embarque_id && !cabecera ? "no_disponible" : "verificado",
        referencias: factura.embarque_id && !cabecera ? null : referenciasLegadas,
      };
      if (!c.embarque_id) return { id: c.id, descripcion: c.descripcion, estado: "sin_origen", referencias: null };
      const origen = porId.get(c.embarque_id);
      return { id: c.id, descripcion: c.descripcion, estado: origen ? "verificado" : "no_disponible", referencias: origen ?? null };
    }),
  };
}
