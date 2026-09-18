/**
 * P1-IVA — Coherencia entre el tratamiento fiscal explícito (`tipo_iva`) y la
 * tasa/flag de la línea (`tasa_iva_aplicada`, `aplica_iva`).
 *
 * Reglas duras del lote:
 *  - `no_objeto` (SAT 01), `exento` y `tasa_0` NUNCA se infieren ni se
 *    convierten entre sí. "No cobrar IVA" no prueba que el tratamiento SAT sea
 *    Exento.
 *  - Una línea gravada con el IVA apagado (o con una tasa que no corresponde a
 *    su tipo) es INCOHERENTE: no se corrige a la callada, se bloquea el
 *    timbrado con un mensaje accionable.
 *  - Una línea SIN `tipo_iva` reconocido es AMBIGUA SIEMPRE (cualquier tasa o
 *    flag): no se adivina el tratamiento y tampoco se impide editarla; sólo se
 *    bloquea emitir CFDI con ella.
 *
 * Espejo Deno (mismas reglas) en `supabase/functions/_shared/coherenciaIva.ts`.
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";
import {
  TASA_IVA_FRONTERA_MX,
  esTipoIvaSat,
  type TipoIvaSat,
} from "@/lib/financial/tipoIvaSat";

export interface FilaIvaClasificable {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | null;
  aplica_iva?: boolean | null;
}

export type EstadoCoherenciaIva = "ok" | "incoherente" | "ambiguo";

export interface ResultadoCoherenciaIva {
  estado: EstadoCoherenciaIva;
  /** Tipo y tasa resueltos; sólo confiables cuando `estado === "ok"`. */
  tipo: TipoIvaSat;
  tasa: number;
  /** Explicación legible cuando el estado no es `ok`. */
  motivo?: string;
}

const EPS = 1e-9;
const igual = (a: number, b: number) => Math.abs(a - b) < EPS;

/** Tasa canónica de cada tratamiento gravado. */
function tasaCanonica(tipo: TipoIvaSat, tasaGlobal: number): number {
  if (tipo === "gravado_8") return TASA_IVA_FRONTERA_MX;
  if (tipo === "gravado_16") return tasaGlobal;
  return 0;
}

const etiquetaNoCausante = (tipo: TipoIvaSat) =>
  tipo === "tasa_0" ? "tasa 0%" : tipo === "exento" ? "exento" : "no objeto de impuesto (SAT 01)";

/** Tratamientos que no causan IVA trasladado. */
function clasificarNoCausante(
  tipo: TipoIvaSat,
  tasaNum: number | null,
  flag: boolean | null | undefined,
): ResultadoCoherenciaIva {
  // P2-IVA: cualquier tasa distinta de cero es incoherente, incluidas las
  // negativas (antes sólo se rechazaba > 0, así que un -16% pasaba como "ok").
  if (tasaNum != null && !igual(tasaNum, 0)) {
    return {
      estado: "incoherente",
      tipo,
      tasa: 0,
      motivo: `está clasificado como ${etiquetaNoCausante(tipo)} pero tiene una tasa de IVA de ${(tasaNum * 100).toFixed(2)}%`,
    };
  }

  if (flag === true && tipo !== "tasa_0") {
    return {
      estado: "incoherente",
      tipo,
      tasa: 0,
      motivo: `está clasificado como ${etiquetaNoCausante(tipo)} pero tiene el IVA activado`,
    };
  }
  return { estado: "ok", tipo, tasa: 0 };
}

/** Tratamientos gravados (16% general u 8% frontera). */
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
    // Gravado sin tasa registrada: el flujo que apagó el IVA dejó la tasa
    // vacía sin cambiar la clasificación. No se rellena con 16%.
    if (flag === true) return { estado: "ok", tipo, tasa: canonica };
    return {
      estado: "incoherente",
      tipo,
      tasa: canonica,
      motivo: `está clasificado como gravado ${pct}% pero no tiene tasa de IVA registrada`,
    };
  }
  if (!igual(tasaNum, canonica)) {
    return {
      estado: "incoherente",
      tipo,
      tasa: canonica,
      motivo: `está clasificado como gravado ${pct}% pero tiene una tasa de ${(tasaNum * 100).toFixed(2)}%`,
    };
  }
  return { estado: "ok", tipo, tasa: canonica };
}

/** Renglones legados: sin `tipo_iva` guardado. */
function clasificarLegado(): ResultadoCoherenciaIva {
  // P1-IVA (ajuste residual): un renglón SIN `tipo_iva` reconocido es AMBIGUO
  // siempre, sin importar tasa ni flag. Antes se resolvía por `tasa`/`flag`
  // (tasa 0 → tasa_0, IVA apagado → exento); eso era inferir el tratamiento
  // SAT, justo lo que el lote prohíbe. `tipo`/`tasa` NO son confiables aquí:
  // sólo existen para cumplir el contrato del tipo de retorno.
  return {
    estado: "ambiguo",
    tipo: "gravado_16",
    tasa: 0,
    motivo:
      "no tiene tratamiento fiscal registrado (tasa 0%, exento, no objeto o gravado), así que no se puede determinar cómo declararlo ante el SAT",
  };
}

/**
 * Clasifica una línea. `tasaGravadoDefault` es la tasa general de la
 * organización (`useTasaIVA()`); sólo se usa para `gravado_16`.
 */
export function clasificarCoherenciaIva(
  fila: FilaIvaClasificable,
  tasaGravadoDefault: number = TASA_IVA,
): ResultadoCoherenciaIva {
  const tasa = fila.tasa_iva_aplicada;
  const tasaNum = tasa != null && Number.isFinite(Number(tasa)) ? Number(tasa) : null;
  const flag = fila.aplica_iva;

  if (!esTipoIvaSat(fila.tipo_iva)) return clasificarLegado();

  const tipo = fila.tipo_iva;
  if (tipo === "no_objeto" || tipo === "exento" || tipo === "tasa_0") {
    return clasificarNoCausante(tipo, tasaNum, flag);
  }
  return clasificarGravado(tipo, tasaCanonica(tipo, tasaGravadoDefault), tasaNum, flag);
}


/** `true` cuando la línea NO se puede timbrar con seguridad. */
export function bloqueaTimbrado(resultado: ResultadoCoherenciaIva): boolean {
  return resultado.estado !== "ok";
}

/** Mensaje accionable para el usuario, con la descripción del renglón. */
export function mensajeCoherenciaIva(
  descripcion: string,
  resultado: ResultadoCoherenciaIva,
): string {
  return `El concepto "${descripcion}" ${resultado.motivo ?? "tiene un tratamiento de IVA inconsistente"}. Corrige el tratamiento fiscal del renglón (16%, 8%, 0%, exento o no objeto) antes de continuar.`;
}
