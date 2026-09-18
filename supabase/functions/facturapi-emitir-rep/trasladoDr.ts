/**
 * Ola E3 · Sub-ola C · N2 — Traslado de IVA del documento relacionado (REP).
 *
 * Antes la tasa se "adivinaba" con la proporción iva/subtotal de la factura y
 * se anclaba a la tasa del catálogo más cercana: con mezcla de tasas eso
 * timbraba un dato falso (p. ej. 16% + exento ⇒ promedio 10% ⇒ 8%).
 *
 * Ahora la tasa se toma de los renglones (`conceptos_factura`): se agrupa por
 * tasa/factor y, si hay más de un grupo con IVA trasladado, se rechaza el
 * timbrado con un mensaje claro en vez de inventar la tasa.
 */

export type FactorIvaDr = "Tasa" | "Exento";

export interface ConceptoTraslado {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null;
}

export interface TrasladoDr {
  tasa: number;
  factor: FactorIvaDr;
}

export const MSG_IVA_MULTITASA =
  "LC_REP_IVA_MULTITASA: La factura relacionada mezcla más de un tratamiento de IVA " +
  "(tasas distintas, o gravado junto con exento o tasa 0%). El complemento de pago declara un solo " +
  "grupo de impuestos por documento relacionado, así que declarar uno de ellos trataría todo el " +
  "importe con una tasa que no le corresponde. Emite el REP desde una factura con tratamiento " +
  "homogéneo o reemite la factura separando los tratamientos.";

/**
 * El complemento de pago 2.0 declara `ObjetoImpDR` por documento relacionado y
 * el arreglo `ImpuestosDR` sólo aplica cuando ObjetoImpDR = 02. La API de
 * Facturapi no expone `ObjetoImpDR` en `related_documents` (sólo `taxes`), así
 * que un renglón "no objeto" (SAT 01) NO se puede representar: declararlo como
 * `Exento` sería un dato fiscal falso. Se bloquea el timbrado.
 */
export const MSG_REP_NO_OBJETO =
  "LC_REP_NO_OBJETO: Esta integración no puede representar ObjetoImpDR=01 ('No objeto de impuesto', " +
  "SAT 01) en el complemento de pago, porque Facturapi no expone ese campo y declararlo como 'Exento' " +
  "sería un dato fiscal incorrecto. Por eso el timbrado del REP se ha bloqueado. Detenga este flujo y " +
  "consulte a Contabilidad o a soporte de Libre Carga para definir el tratamiento autorizado.";

/** Tasas del catálogo SAT c_TasaOCuota admitidas para traslado de IVA. */
const TASAS_SAT: readonly number[] = [0, 0.08, 0.16];

/** Tasa canónica de cada tratamiento; el resto no causa traslado con tasa. */
const TASA_CANONICA: Record<string, number> = {
  gravado_16: 0.16,
  gravado_8: 0.08,
  tasa_0: 0,
};

/** Tolerancia de centavos al comparar la tasa guardada con la canónica. */
const EPS = 1e-6;

export const MSG_REP_TRATAMIENTO_INDETERMINADO =
  "LC_REP_TRATAMIENTO_INDETERMINADO: La factura relacionada tiene renglones sin tratamiento de IVA " +
  "registrado (o con una tasa que contradice su tratamiento), así que no se puede saber cómo declarar " +
  "el impuesto en el complemento de pago. El sistema no supone una tasa. Pide a Contabilidad que " +
  "complete el tratamiento fiscal (16%, 8%, tasa 0%, exento o no objeto) de cada renglón de la factura " +
  "y vuelve a intentar el REP.";

/** `true` si el renglón trae el tratamiento explícito "no objeto" (SAT 01). */
export function esConceptoNoObjeto(c: ConceptoTraslado): boolean {
  return String(c?.tipo_iva ?? "").trim().toLowerCase() === "no_objeto";
}

/**
 * Traslado del renglón. `null` = INDETERMINADO: no hay tratamiento registrado o
 * la tasa guardada contradice el tratamiento. Antes esos casos caían al 16% y
 * el REP declaraba un impuesto que la factura pudo no trasladar.
 */
function tasaDeConcepto(c: ConceptoTraslado): { tasa: number; factor: FactorIvaDr } | null {
  const tipo = String(c?.tipo_iva ?? "").trim().toLowerCase();
  // `exento` sí es representable en el REP (factor Exento). `no_objeto` NO:
  // se detecta antes y bloquea el timbrado (nunca se traduce a Exento).
  if (tipo === "exento") return { tasa: 0, factor: "Exento" };
  if (!(tipo in TASA_CANONICA)) return null;
  const canonica = TASA_CANONICA[tipo];
  const raw = c?.tasa_iva_aplicada;
  if (raw === null || raw === undefined || raw === "") {
    return { tasa: canonica, factor: "Tasa" };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || Math.abs(n - canonica) >= EPS) return null;
  return { tasa: canonica, factor: "Tasa" };
}

/**
 * Respaldo para facturas antiguas SIN renglones capturados: la única fuente es
 * el encabezado. Sólo se acepta cuando el cociente IVA/subtotal cae EXACTO
 * (a centavos) en una tasa del catálogo; si no hay IVA no se puede distinguir
 * exento de tasa 0% y se devuelve `null` para fallar cerrado. Nunca se ancla
 * un promedio a la tasa "más cercana".
 */
export function trasladoDesdeEncabezado(
  subtotal: number,
  iva: number,
): TrasladoDr | null {
  const base = Number(subtotal);
  const impuesto = Number(iva);
  if (!Number.isFinite(base) || !Number.isFinite(impuesto) || base <= 0) return null;
  if (impuesto <= 0) return null;
  const efectiva = impuesto / base;
  for (const tasa of TASAS_SAT) {
    if (tasa > 0 && Math.abs(efectiva - tasa) < 5e-4) return { tasa, factor: "Tasa" };
  }
  return null;
}

/**
 * Traslado a declarar en el REP.
 * - `"no_objeto"` ⇒ la factura tiene conceptos SAT 01, no representables en el
 *   complemento de pago (el llamador responde 422 ANTES del claim).
 * - `null` ⇒ la factura mezcla tratamientos (tasas distintas, o gravado con
 *   exento/tasa 0): el llamador responde 422. NO se elige un grupo "dominante":
 *   eso declararía el importe completo con una tasa que no le corresponde.
 * - `"indeterminado"` ⇒ algún renglón no tiene tratamiento registrado o su tasa
 *   contradice el tratamiento: el llamador responde 422 ANTES del claim.
 * - `"sin_conceptos"` ⇒ facturas antiguas sin renglones capturados: el llamador
 *   usa `trasladoDesdeEncabezado` y bloquea si tampoco alcanza.
 */
export function resolverTrasladoDr(
  conceptos: ConceptoTraslado[] | null | undefined,
): TrasladoDr | null | "sin_conceptos" | "no_objeto" | "indeterminado" {
  const lista = conceptos ?? [];
  if (lista.length === 0) return "sin_conceptos";
  if (lista.some(esConceptoNoObjeto)) return "no_objeto";

  // Un grupo por combinación factor+tasa: Exento, Tasa 0, Tasa 0.08 y Tasa 0.16
  // son grupos DISTINTOS del complemento de pago; cualquier mezcla se bloquea.
  const grupos = new Map<string, TrasladoDr>();
  for (const c of lista) {
    const resuelto = tasaDeConcepto(c);
    if (resuelto === null) return "indeterminado";
    const { tasa, factor } = resuelto;
    const clave = factor === "Exento" ? "Exento" : `Tasa:${tasa.toFixed(6)}`;
    if (!grupos.has(clave)) grupos.set(clave, { tasa, factor });
  }
  if (grupos.size !== 1) return null;
  return [...grupos.values()][0];
}
