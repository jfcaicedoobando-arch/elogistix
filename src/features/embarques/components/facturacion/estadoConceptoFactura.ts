import { facturaEmitida } from "@/lib/domain/etiquetaCicloProforma";

export type EstadoConcepto = "pendiente" | "pendiente_confirmar" | "en_proforma"
  | "facturado" | "en_borrador" | "por_timbrar" | "en_factura"
  | "factura_cancelada" | "factura_sustituida";

export interface FacturaConcepto {
  id: string;
  estado: string | null | undefined;
  moneda: string;
  proforma_id?: string | null;
  deleted_at?: string | null;
}

export interface ProformaConcepto {
  id: string;
  estado_proforma?: string | null;
  factura_id?: string | null;
  factura_secundaria_id?: string | null;
}

/** Sólo presentación: la reserva y la elegibilidad siguen en conceptos_venta. */
export function estadoFacturaConcepto(
  concepto: { proforma_id: string | null; moneda: string },
  facturas: FacturaConcepto[],
  proformas: ProformaConcepto[],
): EstadoConcepto {
  const proforma = proformas.find(p => p.id === concepto.proforma_id);
  // No recuperar una conversión histórica de una proforma terminal.
  if (!concepto.proforma_id || proforma?.estado_proforma === "cancelada") return "en_factura";
  const vinculadas = facturas.filter(f => !f.deleted_at
    && f.moneda === concepto.moneda
    && (f.proforma_id === concepto.proforma_id
      || f.id === proforma?.factura_id || f.id === proforma?.factura_secundaria_id));
  // La referencia de cabecera no supera una FK inversa explícita contradictoria.
  // NULL/undefined sigue siendo válido para fusión o refacturación por ids.
  if (vinculadas.some(f => f.proforma_id != null && f.proforma_id !== concepto.proforma_id)) return "en_factura";
  const estadoDe = (f: FacturaConcepto) => (f.estado ?? "").trim().toLowerCase();
  const vigentes = vinculadas.filter(f => !["cancelada", "sustituida"].includes(estadoDe(f)));
  // Sin linaje a una factura concreta, estados contradictorios no prueban emisión.
  if (new Set(vigentes.map(estadoDe)).size > 1) return "en_factura";
  if (vigentes.some(facturaEmitida)) return "facturado";
  if (vigentes.some(f => estadoDe(f) === "por timbrar")) return "por_timbrar";
  if (vigentes.some(f => estadoDe(f) === "borrador")) return "en_borrador";
  if (vigentes.length > 0) return "en_factura";
  if (vinculadas.some(f => estadoDe(f) === "cancelada")) return "factura_cancelada";
  if (vinculadas.some(f => estadoDe(f) === "sustituida")) return "factura_sustituida";
  return "en_factura";
}

export function esEstadoEnFactura(estado: EstadoConcepto): boolean {
  return !["pendiente", "pendiente_confirmar", "en_proforma"].includes(estado);
}

/** Desglose de conceptos; nunca se usa como conteo de documentos ni de cierre. */
export function detalleConceptosEnFactura(estados: EstadoConcepto[], incluirEmitidos = false): string {
  const grupos: [EstadoConcepto, string, string][] = [
    ["en_borrador", "en borrador", "en borrador"],
    ["por_timbrar", "por timbrar", "por timbrar"],
    ["factura_cancelada", "con factura cancelada", "con factura cancelada"],
    ["factura_sustituida", "con factura sustituida", "con factura sustituida"],
    ["en_factura", "en factura sin estado disponible", "en factura sin estado disponible"],
  ];
  if (incluirEmitidos) grupos.unshift(["facturado", "emitido", "emitidos"]);
  return grupos.flatMap(([estado, singular, plural]) => {
    const count = estados.filter(e => e === estado).length;
    return count > 0 ? [`${count} ${count === 1 ? singular : plural}`] : [];
  }).join(" · ");
}
