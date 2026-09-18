/**
 * P1-IVA — Impuestos por renglón de una nota de crédito.
 *
 * ESPEJO EXACTO de `buildTaxesNc` (supabase/functions/facturapi-emitir-nota-credito/
 * helpers.ts): el total interno que se guarda y se muestra se calcula con la
 * MISMA regla que arma el CFDI, para que el monto de la NC, el resumen y el XML
 * no puedan diferir.
 *
 * Reglas (nunca se infiere ni se corrige un tratamiento):
 *  - `no_objeto` (ObjetoImp 01) y `exento` no causan IVA trasladado.
 *  - `tasa_0` traslada IVA a tasa 0 (grupo distinto de exento).
 *  - `gravado_8` / `gravado_16` usan SIEMPRE su tasa canónica (0.08 / 0.16).
 *  - Un renglón sin `tipo_iva` reconocido es INDETERMINADO: se bloquea antes de
 *    guardar o timbrar (una tasa numérica suelta no dice si el original era
 *    tasa 0%, exento o no objeto).
 *  - Un renglón cuya tasa guardada contradice su tipo es INCOHERENTE y también
 *    bloquea: no se elige silenciosamente una de las dos.
 *  - Las retenciones ISR/IVA del renglón original se reversan igual que en la
 *    factura: restan del total de la NC.
 */
import { roundMoney, subtotalLinea } from "@/lib/financial/financialUtils";
import { TIPO_IVA_LABEL_SAT } from "@/lib/financial/tipoIvaSat";

export const TRATAMIENTOS_NC = [
  "gravado_16",
  "gravado_8",
  "tasa_0",
  "exento",
  "no_objeto",
] as const;

export type TratamientoNC = (typeof TRATAMIENTOS_NC)[number];

/** Tasas canónicas de cada tratamiento (las únicas representables en el CFDI). */
export const TASA_CANONICA_NC: Record<TratamientoNC, number> = {
  gravado_16: 0.16,
  gravado_8: 0.08,
  tasa_0: 0,
  exento: 0,
  no_objeto: 0,
};

const EPS = 1e-9;

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

/** Tasa numérica del renglón, o `null` si no hay una utilizable. */
function tasaNumerica(linea: LineaNC): number | null {
  const t = linea.tasa_iva;
  if (t === null || t === undefined || !Number.isFinite(Number(t))) return null;
  return Number(t);
}

/**
 * Tratamiento efectivo del renglón. `null` = indeterminado: el `tipo_iva` falta
 * o no se reconoce. NO se deduce nada de la tasa: una tasa 0 puede venir de
 * tasa 0%, exento o no objeto, y son tres declaraciones distintas ante el SAT.
 */
export function tratamientoLineaNC(linea: LineaNC): TratamientoNC | null {
  return esTratamientoNC(linea.tipo_iva) ? linea.tipo_iva : null;
}

/** Tasa canónica del tratamiento (0 cuando no causa traslado). */
export function tasaCanonicaNC(tipo: TratamientoNC): number {
  return TASA_CANONICA_NC[tipo];
}

/**
 * Motivo por el que el renglón no se puede acreditar, o `null` si es válido.
 * Mismas reglas de coherencia que la emisión normal de facturas.
 */
export function problemaLineaNC(linea: LineaNC): string | null {
  const tipo = tratamientoLineaNC(linea);
  if (tipo === null) {
    return "sin tratamiento fiscal de IVA definido en la factura original (16%, 8%, tasa 0%, exento o no objeto)";
  }
  const tasa = tasaNumerica(linea);
  const canonica = tasaCanonicaNC(tipo);
  if (tasa !== null && Math.abs(tasa - canonica) >= EPS) {
    return `clasificado como ${TIPO_IVA_LABEL_SAT[tipo]} pero con una tasa guardada de ${(tasa * 100).toFixed(2)}%`;
  }
  return null;
}

/** `true` si el renglón no puede representarse sin inventar el tratamiento. */
export function lineaIndeterminadaNC(linea: LineaNC): boolean {
  return problemaLineaNC(linea) !== null;
}

/** Tasa de IVA trasladado del renglón (0 cuando no causa traslado). */
export function tasaTrasladoNC(linea: LineaNC): number {
  const tipo = tratamientoLineaNC(linea);
  if (tipo === null) return 0;
  return tasaCanonicaNC(tipo);
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

/** Etiqueta de sólo lectura del tratamiento fiscal y retenciones del renglón. */
export function etiquetaTratamientoNC(linea: LineaNC): string {
  const problema = problemaLineaNC(linea);
  if (problema !== null) {
    return `Renglón ${problema}: corrige la factura original y vuelve a generar la nota de crédito.`;
  }
  const tipo = tratamientoLineaNC(linea) as TratamientoNC;
  const partes = [`IVA: ${TIPO_IVA_LABEL_SAT[tipo]}`];
  if (tipo === "gravado_16" || tipo === "gravado_8") {
    const pct = tasaTrasladoNC(linea) * 100;
    partes.push(`tasa ${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`);
  }
  const isr = num(linea.tasa_ret_isr) * 100;
  const retIva = num(linea.tasa_ret_iva) * 100;
  if (isr > 0) partes.push(`retención ISR ${isr.toFixed(isr % 1 === 0 ? 0 : 4)}%`);
  if (retIva > 0) partes.push(`retención IVA ${retIva.toFixed(retIva % 1 === 0 ? 0 : 4)}%`);
  return partes.join(" · ");
}
