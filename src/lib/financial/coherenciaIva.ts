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
 *  - Una línea legada SIN `tipo_iva` cuyo flag y tasa se contradicen es
 *    AMBIGUA: no se adivina el tratamiento y tampoco se impide editarla; sólo
 *    se bloquea emitir CFDI con ella.
 *
 * Espejo Deno (mismas reglas) en `supabase/functions/_shared/coherenciaIva.ts`.
 */
import { TASA_IVA } from "@/lib/financial/financialUtils";
import {
  TASA_IVA_FRONTERA_MX,
  esTipoIvaSat,
  tipoIvaDesdeLegacy,
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

/**
 * Clasifica una línea. `tasaGravadoDefault` es la tasa general de la
 * organización (`useTasaIVA()`); sólo se usa para `gravado_16`.
 */
export function clasificarCoherenciaIva(
  fila: FilaIvaClasificable,
  tasaGravadoDefault: number = TASA_IVA,
): ResultadoCoherenciaIva {
  const tasa = fila.tasa_iva_aplicada;
  const tasaPresente = tasa != null && Number.isFinite(Number(tasa));
  const tasaNum = tasaPresente ? Number(tasa) : null;
  const flag = fila.aplica_iva;

  if (esTipoIvaSat(fila.tipo_iva)) {
    const tipo = fila.tipo_iva;
    const canonica = tasaCanonica(tipo, tasaGravadoDefault);
    const noCausa = tipo === "no_objeto" || tipo === "exento" || tipo === "tasa_0";

    if (noCausa) {
      if (tasaNum != null && tasaNum > 0) {
        return {
          estado: "incoherente",
          tipo,
          tasa: 0,
          motivo: `está clasificado como ${tipo === "tasa_0" ? "tasa 0%" : tipo === "exento" ? "exento" : "no objeto de impuesto (SAT 01)"} pero tiene una tasa de IVA de ${(tasaNum * 100).toFixed(2)}%`,
        };
      }
      if (flag === true && tipo !== "tasa_0") {
        return {
          estado: "incoherente",
          tipo,
          tasa: 0,
          motivo: `está clasificado como ${tipo === "exento" ? "exento" : "no objeto de impuesto (SAT 01)"} pero tiene el IVA activado`,
        };
      }
      return { estado: "ok", tipo, tasa: 0 };
    }

    // Gravado (16% general u 8% frontera).
    if (flag === false) {
      return {
        estado: "incoherente",
        tipo,
        tasa: canonica,
        motivo: `está clasificado como gravado (${(canonica * 100).toFixed(0)}%) pero el IVA quedó desactivado; falta definir si es tasa 0%, exento o no objeto`,
      };
    }
    if (tasaNum != null && !igual(tasaNum, canonica)) {
      return {
        estado: "incoherente",
        tipo,
        tasa: canonica,
        motivo: `está clasificado como gravado ${(canonica * 100).toFixed(0)}% pero tiene una tasa de ${(tasaNum * 100).toFixed(2)}%`,
      };
    }
    return { estado: "ok", tipo, tasa: canonica };
  }

  // Sin tratamiento explícito (legado).
  if (flag === false && tasaNum != null && tasaNum > 0) {
    return {
      estado: "ambiguo",
      tipo: "exento",
      tasa: 0,
      motivo:
        "no tiene tratamiento fiscal registrado: el IVA está desactivado pero conserva una tasa distinta de cero, así que no se puede determinar si es tasa 0%, exento o no objeto",
    };
  }
  const tipo = tipoIvaDesdeLegacy(flag, tasaNum);
  const tasaResuelta = tasaNum != null ? tasaNum : flag ? tasaGravadoDefault : 0;
  return { estado: "ok", tipo, tasa: tasaResuelta };
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
