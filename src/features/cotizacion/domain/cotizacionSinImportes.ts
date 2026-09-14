/**
 * A1/A7 (v13.823.153) — Distingue un borrador REALMENTE vacío de una cotización
 * con contenido económico.
 *
 * Causa del bug: `useConceptosVentaCotizacion` siembra siempre una fila vacía USD
 * y una MXN cuando no hay conceptos. El wizard calculaba `sinImportes` sólo con
 * `length === 0`, así que un borrador vacío se consideraba "con importes", el
 * mapper del paso 1 omitía `moneda` y el vínculo con una oportunidad en MXN
 * seguía fallando por "monedas distintas".
 *
 * Regla: una fila cuenta como contenido real si tiene descripción o algún
 * importe distinto de cero (cantidad × precio, o total). Así no basta con que el
 * total sume cero: conceptos reales compensados siguen protegiendo la moneda.
 * Los costos internos con precio de venta capturado también cuentan.
 */

export interface ConceptoImporteLike {
  descripcion?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  total?: number | null;
}

export interface CostoImporteLike {
  precio_venta?: number | null;
  /** Filas reales del wizard (`FilaCostoLocal`): costo capturado sin venta aún. */
  cantidad?: number | null;
  costo_unitario?: number | null;
  costo_total?: number | null;
  /** Variante persistida/legacy que sí trae un monto plano. */
  monto?: number | null;
}

const num = (v: number | null | undefined): number => Number(v) || 0;

/** true cuando la fila tiene descripción o algún importe capturado. */
export function conceptoTieneContenido(c: ConceptoImporteLike): boolean {
  if ((c.descripcion ?? "").trim().length > 0) return true;
  return num(c.cantidad) * num(c.precio_unitario) !== 0 || num(c.total) !== 0;
}

export function costoTieneContenido(c: CostoImporteLike): boolean {
  if (num(c.precio_venta) !== 0 || num(c.monto) !== 0) return true;
  // A1/A7 (v13.823.156): un costo capturado sin venta todavía es contenido
  // económico; `FilaCostoLocal` no tiene `monto`, trae cantidad × costo_unitario.
  return num(c.cantidad) * num(c.costo_unitario) !== 0 || num(c.costo_total) !== 0;
}

/**
 * true sólo si NINGÚN concepto de venta (USD/MXN) ni costo interno tiene
 * contenido económico: es un borrador que puede adoptar la moneda del CRM.
 */
export function esBorradorSinImportes(
  conceptosUSD: ConceptoImporteLike[],
  conceptosMXN: ConceptoImporteLike[],
  costosInternos: CostoImporteLike[] = [],
): boolean {
  const hayConceptos = [...conceptosUSD, ...conceptosMXN].some(conceptoTieneContenido);
  if (hayConceptos) return false;
  return !costosInternos.some(costoTieneContenido);
}

/**
 * Moneda dominante de los importes capturados: devuelve "USD" o "MXN" sólo si
 * TODO el contenido económico vive en una sola moneda. Con ambas monedas (o sin
 * contenido) devuelve `undefined` para que el llamador decida el respaldo.
 *
 * VF (13.823.198): al CREAR una cotización no hay moneda persistida que
 * proteger; el encabezado se resuelve con esta moneda antes que con el respaldo.
 */
export function monedaDeImportes(
  conceptosUSD: ConceptoImporteLike[],
  conceptosMXN: ConceptoImporteLike[],
  costosInternos: (CostoImporteLike & { moneda?: string | null })[] = [],
): "USD" | "MXN" | undefined {
  const hayUSD =
    conceptosUSD.some(conceptoTieneContenido) ||
    costosInternos.some((c) => c.moneda === "USD" && costoTieneContenido(c));
  const hayMXN =
    conceptosMXN.some(conceptoTieneContenido) ||
    costosInternos.some((c) => c.moneda === "MXN" && costoTieneContenido(c));
  if (hayUSD && !hayMXN) return "USD";
  if (hayMXN && !hayUSD) return "MXN";
  return undefined;
}

// v13.823.364 — Copy del candado "cotización sin importes" según estado.
//
// El PDF no se genera cuando los conceptos de venta suman $0.00, pero pedir
// siempre "sincroniza los conceptos" llevaba a un error seguro: en `Aceptada`
// / `En operación` el trigger `cotizaciones_guard_en_operacion` hace
// inmutables `conceptos_venta`/`subtotal`.

const ESTADOS_INMUTABLES = new Set(["Aceptada", "En operación"]);
const ESTADOS_TERMINALES = new Set(["Rechazada", "Vencida", "Archivada"]);

export interface AvisoSinImportes {
  title: string;
  description: string;
}

/** Mensaje y CTA del candado de PDF/envío para una cotización en $0.00. */
export function mensajeCotizacionSinImportes(
  estado: string | null | undefined,
  tieneEmbarque = false,
): AvisoSinImportes {
  const title = "La cotización no tiene importes";
  if (tieneEmbarque || ESTADOS_INMUTABLES.has(estado ?? "")) {
    return {
      title,
      description:
        "Los conceptos de venta suman $0.00 y esta cotización ya no puede modificarse. Usa Re-cotizar para crear una nueva versión con importes o solicita una revisión administrativa.",
    };
  }
  if (ESTADOS_TERMINALES.has(estado ?? "")) {
    return {
      title,
      description:
        "Los conceptos de venta suman $0.00 y la cotización está cerrada. Crea una nueva versión con importes o solicita una revisión administrativa.",
    };
  }
  return {
    title,
    description:
      "Los conceptos de venta suman $0.00. Revisa la sección de costos y sincroniza los conceptos de venta antes de descargar el PDF.",
  };
}
