/**
 * P1-IVA (lado servidor) — espejo Deno de `src/lib/financial/coherenciaIva.ts`.
 *
 * Mismas reglas: `no_objeto`/`exento`/`tasa_0` no se infieren ni se traducen
 * entre sí; una combinación contradictoria o un renglón legado ambiguo NO se
 * "arregla" con un 16% por omisión: se bloquea el timbrado con un mensaje
 * accionable. Se duplica a propósito porque las edge functions no pueden
 * importar `src/`.
 */
export type TipoIvaSat = "gravado_16" | "gravado_8" | "tasa_0" | "exento" | "no_objeto";

const TIPOS: readonly string[] = ["gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto"];
const TASA_GENERAL = 0.16;
const TASA_FRONTERA = 0.08;
const EPS = 1e-9;

export interface FilaIvaClasificable {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null;
  aplica_iva?: boolean | null;
}

export interface ResultadoCoherenciaIva {
  estado: "ok" | "incoherente" | "ambiguo";
  tipo: TipoIvaSat;
  tasa: number;
  motivo?: string;
}

function tasaCanonica(tipo: TipoIvaSat, tasaGlobal: number): number {
  if (tipo === "gravado_8") return TASA_FRONTERA;
  if (tipo === "gravado_16") return tasaGlobal;
  return 0;
}

function etiquetaNoCausante(tipo: TipoIvaSat): string {
  if (tipo === "tasa_0") return "tasa 0%";
  if (tipo === "exento") return "exento";
  return "no objeto de impuesto (SAT 01)";
}

/** Tratamientos que NO causan IVA trasladado: tasa_0, exento, no_objeto. */
function clasificarNoCausante(
  tipo: TipoIvaSat,
  tasaNum: number | null,
  flag: boolean | null | undefined,
): ResultadoCoherenciaIva {
  const etiqueta = etiquetaNoCausante(tipo);
  // P2-IVA: cualquier tasa distinta de cero (incluida una negativa) es
  // incoherente para un tratamiento que no causa IVA trasladado.
  if (tasaNum != null && Math.abs(tasaNum) >= EPS) {
    return {
      estado: "incoherente",
      tipo,
      tasa: 0,
      motivo: `está clasificado como ${etiqueta} pero tiene una tasa de IVA de ${(tasaNum * 100).toFixed(2)}%`,
    };
  }
  if (flag === true && tipo !== "tasa_0") {
    return { estado: "incoherente", tipo, tasa: 0, motivo: `está clasificado como ${etiqueta} pero tiene el IVA activado` };
  }
  return { estado: "ok", tipo, tasa: 0 };
}

/** Tratamientos gravados: gravado_16 y gravado_8. */
function clasificarGravado(
  tipo: TipoIvaSat,
  canonica: number,
  tasaNum: number | null,
  flag: boolean | null | undefined,
): ResultadoCoherenciaIva {
  const pct = (canonica * 100).toFixed(0);
  if (flag === false) {
    return {
      estado: "incoherente",
      tipo,
      tasa: canonica,
      motivo: `está clasificado como gravado (${pct}%) pero el IVA quedó desactivado; falta definir si es tasa 0%, exento o no objeto`,
    };
  }
  if (tasaNum == null) {
    if (flag === true) return { estado: "ok", tipo, tasa: canonica };
    return {
      estado: "incoherente",
      tipo,
      tasa: canonica,
      motivo: `está clasificado como gravado ${pct}% pero no tiene tasa de IVA registrada`,
    };
  }
  if (Math.abs(tasaNum - canonica) >= EPS) {
    return {
      estado: "incoherente",
      tipo,
      tasa: canonica,
      motivo: `está clasificado como gravado ${pct}% pero tiene una tasa de ${(tasaNum * 100).toFixed(2)}%`,
    };
  }
  return { estado: "ok", tipo, tasa: canonica };
}

/** Renglón legado sin `tipo_iva` reconocido: AMBIGUO siempre. */
function clasificarAmbiguo(): ResultadoCoherenciaIva {
  // No se infiere tasa_0 desde una tasa 0 ni exento desde el IVA apagado.
  // `tipo`/`tasa` no son confiables cuando el estado no es "ok".
  return {
    estado: "ambiguo",
    tipo: "gravado_16",
    tasa: 0,
    motivo:
      "no tiene tratamiento fiscal registrado (tasa 0%, exento, no objeto o gravado), así que no se puede determinar cómo declararlo ante el SAT",
  };
}

export function clasificarCoherenciaIva(
  fila: FilaIvaClasificable,
  tasaGravadoDefault: number = TASA_GENERAL,
): ResultadoCoherenciaIva {
  const crudo = fila.tasa_iva_aplicada;
  const tasaNum = crudo != null && Number.isFinite(Number(crudo)) ? Number(crudo) : null;
  const flag = fila.aplica_iva;

  if (typeof fila.tipo_iva !== "string" || !TIPOS.includes(fila.tipo_iva)) return clasificarAmbiguo();

  const tipo = fila.tipo_iva as TipoIvaSat;
  const noCausa = tipo === "no_objeto" || tipo === "exento" || tipo === "tasa_0";
  if (noCausa) return clasificarNoCausante(tipo, tasaNum, flag);
  return clasificarGravado(tipo, tasaCanonica(tipo, tasaGravadoDefault), tasaNum, flag);
}

export function mensajeCoherenciaIva(descripcion: string, resultado: ResultadoCoherenciaIva): string {
  return `El concepto "${descripcion}" ${resultado.motivo ?? "tiene un tratamiento de IVA inconsistente"}. Corrige el tratamiento fiscal del renglón (16%, 8%, 0%, exento o no objeto) antes de timbrar.`;
}
