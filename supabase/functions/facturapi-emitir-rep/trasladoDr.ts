/**
 * Traslados de IVA del documento relacionado (REP · Complemento de Pagos 2.0).
 *
 * Historia:
 *  - Antes la tasa se "adivinaba" con la proporción iva/subtotal y se anclaba a
 *    la tasa más cercana del catálogo (16% + exento ⇒ 8%: dato falso).
 *  - Luego cualquier mezcla de tratamientos bloqueaba el REP, lo que dejaba sin
 *    cobro a facturas PPD válidas (16% + 0%, 16% + 8%, 16% + exento).
 *
 * P1 · Auditoría IVA — Facturapi acepta `related_documents[].taxes` como ARREGLO
 * de impuestos del documento relacionado, así que ahora se conserva UN grupo por
 * combinación factor+tasa y su base se prorratea con el importe del renglón
 * (`helpers.ts · buildTaxesDr`). Nunca se usa una tasa promedio ni se elige un
 * grupo "dominante".
 */

export type FactorIvaDr = "Tasa" | "Exento";

export interface ConceptoTraslado {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null;
  /** Importe del renglón sin impuestos (columna `total` de conceptos_factura). */
  total?: number | string | null;
  cantidad?: number | string | null;
  precio_unitario?: number | string | null;
}

export interface TrasladoDr {
  tasa: number;
  factor: FactorIvaDr;
}

/** Grupo de traslado con el importe (sin IVA) que le corresponde en la factura. */
export interface GrupoTrasladoDr extends TrasladoDr {
  importe: number;
}

/**
 * El complemento de pago 2.0 declara `ObjetoImpDR` por documento relacionado y
 * el arreglo `ImpuestosDR` sólo aplica cuando ObjetoImpDR = 02. La API de
 * Facturapi no expone `ObjetoImpDR` en `related_documents` (sólo `taxes`).
 *
 * Desde el lote "XML manual" el REP de una factura con renglones "no objeto"
 * SÍ se timbra: el complemento se serializa a mano y viaja en el nodo
 * `complements` (ver `pagoXml.ts` y `repManual.ts`), declarando ObjetoImpDR
 * real. Nunca se traduce a `Exento`.
 *
 * Este mensaje queda como RED DE SEGURIDAD: si el proveedor rechaza el XML o la
 * ruta manual no está disponible, el pago queda en estado "Error" con este
 * texto, íntegro (no se pierde ni se duplica, ni se marca timbrado) y
 * reintentable.
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

export const MSG_REP_IMPORTES_FALTANTES =
  "LC_REP_IMPORTES_FALTANTES: La factura relacionada mezcla varios tratamientos de IVA, pero sus " +
  "renglones no tienen importe capturado, así que no se puede prorratear la base de cada grupo de " +
  "impuestos en el complemento de pago. Pide a Contabilidad que revise los importes de los renglones " +
  "de la factura y vuelve a intentar el REP.";

/**
 * P1 · Auditoría IVA — Una consulta de renglones que FALLA no es lo mismo que
 * una factura legacy SIN renglones: si se confunden, el REP se timbraría con
 * los impuestos inferidos del encabezado y SIN las retenciones reales. Por eso
 * el error de lectura corta el flujo antes del claim y antes del PAC.
 */
export const MSG_REP_CONCEPTOS_ILEGIBLES =
  "LC_REP_CONCEPTOS_ILEGIBLES: No se pudieron leer los renglones de la factura relacionada, así que " +
  "no es posible saber qué IVA y qué retenciones debe declarar el complemento de pago. No se timbró " +
  "nada. Vuelve a intentarlo en unos minutos; si el problema sigue, avisa a soporte de Libre Carga.";


/** `true` si el renglón trae el tratamiento explícito "no objeto" (SAT 01). */
export function esConceptoNoObjeto(c: ConceptoTraslado): boolean {
  return String(c?.tipo_iva ?? "").trim().toLowerCase() === "no_objeto";
}


/**
 * Traslado del renglón. `null` = INDETERMINADO: no hay tratamiento registrado o
 * la tasa guardada contradice el tratamiento. Nunca cae al 16%.
 */
function tasaDeConcepto(c: ConceptoTraslado): TrasladoDr | null {
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

/** Importe del renglón sin impuestos: `total` o cantidad × precio unitario. */
export function importeDeConcepto(c: ConceptoTraslado): number {
  const total = Number(c?.total ?? Number.NaN);
  if (Number.isFinite(total) && total > 0) return total;
  const cantidad = Number(c?.cantidad ?? Number.NaN);
  const precio = Number(c?.precio_unitario ?? Number.NaN);
  if (Number.isFinite(cantidad) && Number.isFinite(precio) && cantidad * precio > 0) {
    return cantidad * precio;
  }
  return 0;
}

/** Clave de agrupación: Exento, Tasa 0, Tasa 0.08 y Tasa 0.16 son distintos. */
function claveGrupo(t: TrasladoDr): string {
  return t.factor === "Exento" ? "Exento" : `Tasa:${t.tasa.toFixed(6)}`;
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
 * Grupos de traslado a declarar en el REP (uno por combinación factor+tasa).
 * - `"no_objeto"` ⇒ la factura tiene conceptos SAT 01, no representables en el
 *   complemento de pago (el llamador responde 422 ANTES del claim).
 * - `"indeterminado"` ⇒ algún renglón no tiene tratamiento registrado o su tasa
 *   contradice el tratamiento: el llamador responde 422 ANTES del claim.
 * - `"sin_importes"` ⇒ hay más de un grupo pero los renglones no traen importe,
 *   así que no se puede prorratear la base: el llamador responde 422.
 * - `"sin_conceptos"` ⇒ facturas antiguas sin renglones capturados: el llamador
 *   usa `trasladoDesdeEncabezado` y bloquea si tampoco alcanza.
 */
export function resolverGruposTrasladoDr(
  conceptos: ConceptoTraslado[] | null | undefined,
): GrupoTrasladoDr[] | "sin_conceptos" | "no_objeto" | "indeterminado" | "sin_importes" {
  const lista = conceptos ?? [];
  if (lista.length === 0) return "sin_conceptos";
  if (lista.some(esConceptoNoObjeto)) return "no_objeto";

  const grupos = new Map<string, GrupoTrasladoDr>();
  for (const c of lista) {
    const resuelto = tasaDeConcepto(c);
    if (resuelto === null) return "indeterminado";
    const clave = claveGrupo(resuelto);
    const previo = grupos.get(clave);
    const importe = importeDeConcepto(c);
    if (previo) previo.importe += importe;
    else grupos.set(clave, { ...resuelto, importe });
  }
  const salida = [...grupos.values()];
  // Con un solo grupo la base es el pago completo sin IVA: no hace falta
  // importe por renglón (compatibilidad con facturas legacy sin `total`).
  if (salida.length > 1 && salida.reduce((a, g) => a + g.importe, 0) <= 0) {
    return "sin_importes";
  }
  return salida;
}
