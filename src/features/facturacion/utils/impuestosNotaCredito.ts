/**
 * P1-IVA — Impuestos por renglón de una nota de crédito.
 *
 * ESPEJO EXACTO de `buildTaxesNc` (supabase/functions/facturapi-emitir-nota-credito/
 * helpers.ts): el total interno que se guarda y se muestra se calcula con la
 * MISMA regla que arma el CFDI, para que el monto de la NC, el resumen y el XML
 * no puedan diferir.
 *
 * Reglas (nunca se infiere un tratamiento):
 *  - `no_objeto` (ObjetoImp 01) y `exento` no causan IVA trasladado.
 *  - `tasa_0` traslada IVA a tasa 0 (grupo distinto de exento).
 *  - `gravado_8` / `gravado_16` usan la tasa guardada del renglón; si falta,
 *    caen a 0.08 / 0.16 respectivamente.
 *  - Un renglón sin `tipo_iva` reconocido y sin tasa numérica es INDETERMINADO:
 *    se bloquea antes de guardar o timbrar (no se supone 16%).
 *  - Las retenciones ISR/IVA del renglón original se reversan igual que en la
 *    factura: restan del total de la NC.
 */
import { roundMoney, subtotalLinea } from "@/lib/financial/financialUtils";

export const TRATAMIENTOS_NC = [
  "gravado_16",
  "gravado_8",
  "tasa_0",
  "exento",
  "no_objeto",
] as const;

export type TratamientoNC = (typeof TRATAMIENTOS_NC)[number];

export interface LineaNC {
  cantidad?: number | null;
  precio_unitario?: number | null;
  tasa_iva?: number | null;
  tipo_iva?: string | null;
  tasa_ret_isr?: number | null;
  tasa_ret_iva?: number | null;
}

export function esTratamientoNC(v: unknown): v is TratamientoNC {
  return typeof v === "string" && (TRATAMIENTOS_NC as readonly string[]).includes(v);
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Tratamiento efectivo del renglón. `null` = indeterminado (no hay tipo
 * reconocido ni tasa numérica): el llamador debe bloquear.
 * Un renglón legacy con tasa numérica explícita se trata como gravado a esa
 * tasa (misma regla histórica del payload); NUNCA se deduce exento ni no objeto.
 */
export function tratamientoLineaNC(linea: LineaNC): TratamientoNC | null {
  if (esTratamientoNC(linea.tipo_iva)) return linea.tipo_iva;
  const tasa = linea.tasa_iva;
  if (tasa === null || tasa === undefined || !Number.isFinite(Number(tasa))) return null;
  return Number(tasa) === 0 ? "tasa_0" : "gravado_16";
}

/** `true` si el renglón no puede representarse sin inventar el tratamiento. */
export function lineaIndeterminadaNC(linea: LineaNC): boolean {
  return tratamientoLineaNC(linea) === null;
}

/** Tasa de IVA trasladado del renglón (0 cuando no causa traslado). */
export function tasaTrasladoNC(linea: LineaNC): number {
  const tipo = tratamientoLineaNC(linea);
  if (tipo === null || tipo === "no_objeto" || tipo === "exento") return 0;
  if (tipo === "tasa_0") return 0;
  const tasa = linea.tasa_iva;
  if (tasa === null || tasa === undefined || !Number.isFinite(Number(tasa))) {
    return tipo === "gravado_8" ? 0.08 : 0.16;
  }
  return Number(tasa);
}

export interface ImpuestosLineaNC {
  base: number;
  iva: number;
  retIsr: number;
  retIva: number;
  total: number;
}

/** Base, IVA trasladado, retenciones y total del renglón (todo redondeado). */
export function impuestosLineaNC(linea: LineaNC): ImpuestosLineaNC {
  const base = subtotalLinea(num(linea.cantidad), num(linea.precio_unitario));
  const iva = roundMoney(base * tasaTrasladoNC(linea));
  const retIsr = roundMoney(base * num(linea.tasa_ret_isr));
  const retIva = roundMoney(base * num(linea.tasa_ret_iva));
  return { base, iva, retIsr, retIva, total: roundMoney(base + iva - retIsr - retIva) };
}

/**
 * Factor por el que se multiplica la base para llegar al total del renglón
 * (1 + tasa IVA − retenciones). Se usa para despejar el precio a partir de un
 * total deseado (atajo "por el saldo completo").
 */
export function factorTotalNC(linea: LineaNC): number {
  return 1 + tasaTrasladoNC(linea) - num(linea.tasa_ret_isr) - num(linea.tasa_ret_iva);
}

/** Clave del grupo fiscal del renglón: dos renglones con la misma clave son homogéneos. */
export function claveTratamientoNC(linea: LineaNC): string {
  const tipo = tratamientoLineaNC(linea);
  if (tipo === null) return "indeterminado";
  return [
    tipo,
    tasaTrasladoNC(linea).toFixed(6),
    num(linea.tasa_ret_isr).toFixed(6),
    num(linea.tasa_ret_iva).toFixed(6),
  ].join("|");
}
