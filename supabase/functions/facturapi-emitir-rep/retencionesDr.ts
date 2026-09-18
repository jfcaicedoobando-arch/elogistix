/**
 * Retenciones del CFDI relacionado para el REP (Complemento de Pagos 2.0).
 *
 * Historia:
 *  - Ola 12 · R3P-19: se declaraba UNA tasa por impuesto y cualquier mezcla
 *    (IVA retenido 4% + 10.6667%) bloqueaba el timbrado, aunque la factura
 *    fuera perfectamente emitible.
 *  - P1 · Auditoría IVA: el SAT admite `RetencionDR` de 1 a ilimitado con su
 *    propia `BaseDR`, así que ahora se conserva UN grupo por combinación
 *    impuesto+tasa con el importe de los renglones que la traen. `helpers.ts`
 *    prorratea esa base con el pago; nunca se usa la base total del documento
 *    para una retención que sólo aplica a algunos renglones.
 */
import { importeDeConcepto } from "./trasladoDr.ts";

export interface ConceptoRetencion {
  tasa_ret_isr?: number | string | null;
  tasa_ret_iva?: number | string | null;
  /** Importe del renglón sin impuestos (columna `total` de conceptos_factura). */
  total?: number | string | null;
  cantidad?: number | string | null;
  precio_unitario?: number | string | null;
}

/** Retención con el importe (sin IVA) de los renglones a los que aplica. */
export interface GrupoRetencionDr {
  tipo: "IVA" | "ISR";
  tasa: number;
  importe: number;
}

export const MSG_RETENCIONES_SIN_IMPORTES =
  "LC_REP_RETENCIONES_SIN_IMPORTES: La factura relacionada tiene retenciones (ISR o IVA) en renglones " +
  "sin importe capturado, así que no se puede calcular la base de cada retención en el complemento de " +
  "pago. Pide a Contabilidad que revise los importes de los renglones de la factura y vuelve a intentar " +
  "el REP. El sistema no reparte la retención sobre toda la factura.";

const CAMPOS: ReadonlyArray<{ tipo: "ISR" | "IVA"; campo: "tasa_ret_isr" | "tasa_ret_iva" }> = [
  { tipo: "ISR", campo: "tasa_ret_isr" },
  { tipo: "IVA", campo: "tasa_ret_iva" },
];

function clave(tipo: string, tasa: number): string {
  return `${tipo}:${tasa.toFixed(6)}`;
}

/**
 * Grupos de retención a declarar (uno por impuesto+tasa) con el importe de los
 * renglones que la traen. `"sin_importes"` cuando un renglón con retención no
 * tiene importe: el llamador responde 422 ANTES del claim.
 */
export function resolverGruposRetencionDr(
  conceptos: ConceptoRetencion[] | null | undefined,
): GrupoRetencionDr[] | "sin_importes" {
  const grupos = new Map<string, GrupoRetencionDr>();
  for (const c of conceptos ?? []) {
    for (const { tipo, campo } of CAMPOS) {
      const tasa = Number(c?.[campo] ?? 0);
      if (!Number.isFinite(tasa) || tasa <= 0) continue;
      const importe = importeDeConcepto(c);
      if (importe <= 0) return "sin_importes";
      const k = clave(tipo, tasa);
      const previo = grupos.get(k);
      if (previo) previo.importe += importe;
      else grupos.set(k, { tipo, tasa, importe });
    }
  }
  // ISR antes que IVA y tasas ascendentes: salida estable para pruebas y PAC.
  return [...grupos.values()].sort((a, b) =>
    a.tipo === b.tipo ? a.tasa - b.tasa : a.tipo === "ISR" ? -1 : 1
  );
}
