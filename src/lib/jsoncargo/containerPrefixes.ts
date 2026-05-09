/**
 * Catálogo local de prefixes BIC (4 letras iniciales del contenedor) → naviera(s).
 * Sirve para validar ANTES de llamar a JSONCargo y evitar consumir cuota cuando el
 * prefix no corresponde a la naviera registrada en el embarque.
 *
 * Fuente: prefixes públicos comunes de cada naviera + contenedores leasing más usados.
 * No es exhaustivo: si un prefix no está aquí se considera "desconocido" (no bloquea).
 */
import type { JsonCargoShippingLine } from "./navieras";

const NAVIERA_LABELS: Record<JsonCargoShippingLine, string> = {
  MAERSK: "Maersk",
  HAPAG_LLOYD: "Hapag-Lloyd",
  HMM: "HMM",
  ONE: "Ocean Network Express (ONE)",
  EVERGREEN: "Evergreen",
  MSC: "MSC",
  CMA_CGM: "CMA CGM",
  COSCO: "COSCO",
  ZIM: "ZIM",
  YANG_MING: "Yang Ming",
  PIL: "PIL",
};

/**
 * Mapa prefix → navieras conocidas que lo usan.
 * Algunos prefixes (ej. TEMU = Triton leasing usado por Evergreen) pueden mapear
 * a más de una naviera; devolvemos todas y la UI sugiere.
 */
export const PREFIX_TO_CARRIERS: Record<string, JsonCargoShippingLine[]> = {
  // Maersk
  MAEU: ["MAERSK"], MRKU: ["MAERSK"], MSKU: ["MAERSK"], MRSU: ["MAERSK"],
  MIEU: ["MAERSK"], MNBU: ["MAERSK"], PONU: ["MAERSK"], SEAU: ["MAERSK"],
  // MSC
  MSCU: ["MSC"], MEDU: ["MSC"], MSDU: ["MSC"], MSWU: ["MSC"], FCIU: ["MSC"],
  // Hapag-Lloyd
  HLXU: ["HAPAG_LLOYD"], HLBU: ["HAPAG_LLOYD"], HLCU: ["HAPAG_LLOYD"],
  UACU: ["HAPAG_LLOYD"], CAIU: ["HAPAG_LLOYD"], TGHU: ["HAPAG_LLOYD"],
  // CMA CGM
  CMAU: ["CMA_CGM"], CGMU: ["CMA_CGM"], CXDU: ["CMA_CGM"], ECMU: ["CMA_CGM"],
  APHU: ["CMA_CGM"], APZU: ["CMA_CGM"], CXRU: ["CMA_CGM"],
  // COSCO
  COSU: ["COSCO"], CCLU: ["COSCO"], CBHU: ["COSCO"], CSNU: ["COSCO"],
  CSLU: ["COSCO"], OOLU: ["COSCO"], OOCU: ["COSCO"],
  // Evergreen
  EGHU: ["EVERGREEN"], EISU: ["EVERGREEN"], EITU: ["EVERGREEN"],
  EMCU: ["EVERGREEN"], HMCU: ["EVERGREEN"], EGSU: ["EVERGREEN"],
  // ZIM
  ZIMU: ["ZIM"], ZCSU: ["ZIM"],
  // Yang Ming
  YMLU: ["YANG_MING"], YMMU: ["YANG_MING"], YMUU: ["YANG_MING"],
  // ONE
  ONEU: ["ONE"], TLLU: ["ONE"], KKFU: ["ONE"], KKTU: ["ONE"],
  // HMM (Hyundai Merchant Marine)
  HMMU: ["HMM"], HDMU: ["HMM"],
  // PIL
  PCIU: ["PIL"], PILU: ["PIL"],
  // Leasing pools (Beacon, Triton, Genstar, etc.) — se asignan a múltiples
  // navieras grandes; permitimos cualquiera de las soportadas para no bloquear
  // contenedores reales que sí existen en JSONCargo bajo otra naviera.
  TEMU: ["EVERGREEN", "MSC", "ONE", "MAERSK", "CMA_CGM", "HAPAG_LLOYD"],
  TCLU: ["MSC", "MAERSK", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TCNU: ["MSC", "MAERSK", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TGBU: ["HAPAG_LLOYD", "ONE", "MAERSK", "MSC", "EVERGREEN", "CMA_CGM"],
  BEAU: ["MAERSK", "MSC", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  BMOU: ["MSC", "MAERSK", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  CAXU: ["CMA_CGM"],
  CRXU: ["CMA_CGM"],
  GLDU: ["MAERSK", "EVERGREEN", "MSC", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  GESU: ["MAERSK", "MSC", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TRHU: ["EVERGREEN", "MAERSK", "MSC", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TRIU: ["EVERGREEN", "MAERSK", "MSC", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TLLU2: ["ONE"],
  SEGU: ["MAERSK", "MSC", "EVERGREEN", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  TGCU: ["EVERGREEN", "MAERSK", "MSC", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  UESU: ["EVERGREEN", "MAERSK", "MSC", "ONE", "CMA_CGM", "HAPAG_LLOYD"],
  WHLU: ["EVERGREEN"],
};

/** Extrae las primeras 4 letras alfabéticas en mayúsculas. Devuelve null si no hay. */
export function extractPrefix(container: string | null | undefined): string | null {
  if (!container) return null;
  const m = container.trim().toUpperCase().match(/^[A-Z]{4}/);
  return m ? m[0] : null;
}

export function getCarriersForPrefix(prefix: string | null): JsonCargoShippingLine[] {
  if (!prefix) return [];
  return PREFIX_TO_CARRIERS[prefix] ?? [];
}

export function carrierLabel(c: JsonCargoShippingLine): string {
  return NAVIERA_LABELS[c];
}

export interface PrefixValidationResult {
  /** true si el prefix es desconocido (no bloquear) o si coincide con la naviera. */
  valid: boolean;
  prefix: string | null;
  /** Navieras sugeridas si NO coincide. Vacío si valid=true o prefix desconocido. */
  suggestions: JsonCargoShippingLine[];
  /** true si el prefix existe en el catálogo (conocido). */
  known: boolean;
}

/**
 * Valida que el prefix del contenedor sea compatible con la naviera mapeada.
 * - Si el prefix no existe en el catálogo → valid=true, known=false (no bloquea).
 * - Si existe y la naviera está en su lista → valid=true.
 * - Si existe y la naviera NO está → valid=false, suggestions=carriers conocidos.
 */
export function validatePrefixMatchesNaviera(
  container: string | null | undefined,
  naviera: JsonCargoShippingLine | null | undefined,
): PrefixValidationResult {
  const prefix = extractPrefix(container);
  if (!prefix) return { valid: true, prefix: null, suggestions: [], known: false };
  const carriers = PREFIX_TO_CARRIERS[prefix];
  if (!carriers || carriers.length === 0) {
    return { valid: true, prefix, suggestions: [], known: false };
  }
  if (naviera && carriers.includes(naviera)) {
    return { valid: true, prefix, suggestions: [], known: true };
  }
  return { valid: false, prefix, suggestions: carriers, known: true };
}
