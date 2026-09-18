/**
 * P1 · Auditoría IVA — Reglas del tratamiento "No objeto de impuesto" (SAT
 * ObjetoImp = 01). Espejo exacto de `supabase/functions/_shared/noObjetoFiscal.ts`
 * (el servidor es la autoridad; aquí sólo se evita capturar lo imposible).
 *
 * 1) Guía de llenado del SAT: con ObjetoImp 01 el CFDI NO debe traer nodo de
 *    impuestos para ese concepto. Por eso un renglón no objeto no puede llevar
 *    retenciones de ISR ni de IVA (antes se conservaban ocultas y el payload
 *    salía con `taxability:"01"` y un arreglo de impuestos no vacío).
 * 2) LIMITACIÓN DE LA INTEGRACIÓN, NO DE LA EMISIÓN: el Anexo 29 de la RMF
 *    contempla ObjetoImpDR 01 en el complemento de pago (sin nodo ImpuestosDR),
 *    pero la referencia pública de Facturapi no documenta ese campo en
 *    `related_documents`. Facturapi confirmó que PPD es del CFDI completo y que
 *    `taxability` es por concepto, así que la factura PPD con renglones no
 *    objeto SÍ se emite; lo único que puede quedar pendiente es el REP del
 *    cobro, y eso se avisa (no se bloquea) y nunca se simula como Exento.
 */

export const MSG_NO_OBJETO_RETENCIONES =
  "Un concepto \"No objeto de impuesto\" (SAT ObjetoImp 01) no puede llevar retenciones de ISR ni de IVA: " +
  "la guía de llenado del SAT indica que ese renglón no debe declarar impuestos. Quita la retención o " +
  "cambia el tratamiento fiscal del concepto.";

/**
 * Advertencia NO bloqueante: la factura PPD con renglones no objeto se emite
 * normalmente; el riesgo está en el complemento de pago del cobro posterior.
 */
export const AVISO_NO_OBJETO_PPD_REP =
  "Aviso: esta factura es PPD y tiene conceptos \"No objeto de impuesto\" (SAT ObjetoImp 01). La emisión " +
  "es válida y se hace normalmente; sin embargo, nuestro proveedor de timbrado no documenta el campo " +
  "ObjetoImpDR del complemento de pago, así que al registrar el cobro el REP puede quedar en error y " +
  "requerir seguimiento con Contabilidad. Nunca se cambiará el tratamiento a Exento ni a Tasa 0%.";

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

/**
 * `true` cuando conviene ADVERTIR (no bloquear) por el REP: método PPD con al
 * menos un renglón no objeto. La emisión de la factura no se detiene.
 */
export function ppdConNoObjetoRequiereAviso(
  metodoPago: string | null | undefined,
  lineas: readonly LineaNoObjeto[] | null | undefined,
): boolean {
  return String(metodoPago ?? "").trim().toUpperCase() === "PPD" && hayLineaNoObjeto(lineas);
}
