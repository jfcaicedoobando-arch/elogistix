/**
 * P1 · Auditoría IVA — Reglas del tratamiento "No objeto de impuesto" (SAT
 * ObjetoImp = 01). Espejo exacto de `src/lib/financial/noObjetoFiscal.ts`.
 * Este lado es la AUTORIDAD: la UI sólo evita capturar lo imposible.
 *
 * 1) Guía de llenado del SAT: con ObjetoImp 01 el CFDI NO debe traer nodo de
 *    impuestos para ese concepto ⇒ un renglón no objeto no puede llevar
 *    retenciones de ISR ni de IVA.
 * 2) LIMITACIÓN DE LA INTEGRACIÓN (no del SAT): el Anexo 29 de la RMF sí
 *    contempla ObjetoImpDR 01, pero la API de Facturapi no expone ese campo en
 *    `related_documents`, así que una factura PPD con un renglón no objeto se
 *    quedaría sin REP al cobrarse.
 */

export const MSG_NO_OBJETO_RETENCIONES =
  "Un concepto \"No objeto de impuesto\" (SAT ObjetoImp 01) no puede llevar retenciones de ISR ni de IVA: " +
  "la guía de llenado del SAT indica que ese renglón no debe declarar impuestos. Quita la retención o " +
  "cambia el tratamiento fiscal del concepto.";

export const MSG_NO_OBJETO_PPD =
  "Una factura con conceptos \"No objeto de impuesto\" (SAT ObjetoImp 01) no puede emitirse como PPD: el " +
  "complemento de pago no permite declarar ObjetoImpDR=01, así que el cobro se quedaría sin REP. Emítela " +
  "como PUE o corrige el tratamiento fiscal del concepto con Contabilidad (nunca a Exento ni Tasa 0% por " +
  "conveniencia).";

export interface LineaNoObjeto {
  tipo_iva?: string | null;
  tasa_ret_isr?: number | string | null;
  tasa_ret_iva?: number | string | null;
}

/** `true` sólo con el tratamiento explícito "no objeto" (nunca se infiere). */
export function esLineaNoObjeto(linea: LineaNoObjeto): boolean {
  return String(linea?.tipo_iva ?? "").trim().toLowerCase() === "no_objeto";
}

function tasaPositiva(valor: number | string | null | undefined): boolean {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) && n > 0;
}

/** `true` si el renglón trae alguna retención capturada. */
export function tieneRetenciones(linea: LineaNoObjeto): boolean {
  return tasaPositiva(linea?.tasa_ret_isr) || tasaPositiva(linea?.tasa_ret_iva);
}

/** Combinación prohibida: no objeto + retención (bloquea antes del PAC). */
export function retencionesIncompatiblesNoObjeto(linea: LineaNoObjeto): boolean {
  return esLineaNoObjeto(linea) && tieneRetenciones(linea);
}

/** `true` si alguna línea es no objeto. */
export function hayLineaNoObjeto(lineas: readonly LineaNoObjeto[] | null | undefined): boolean {
  return (lineas ?? []).some(esLineaNoObjeto);
}

/** `true` cuando el método de pago PPD es inviable por un renglón no objeto. */
export function ppdIncompatibleNoObjeto(
  metodoPago: string | null | undefined,
  lineas: readonly LineaNoObjeto[] | null | undefined,
): boolean {
  return String(metodoPago ?? "").trim().toUpperCase() === "PPD" && hayLineaNoObjeto(lineas);
}
