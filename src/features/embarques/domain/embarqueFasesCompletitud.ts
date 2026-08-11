/**
 * Reglas de completitud de las fases canónicas de un embarque (v13.496.1,
 * antes dentro de `embarqueFases.ts` — Power of 10: archivos ≤ 200 líneas).
 *
 * Lógica pura: dado el estado visual del embarque, decide qué fases ya se
 * consideran cumplidas. Un embarque en Borrador nunca marca tránsito ni
 * arribo por fechas vencidas (v13.492.0).
 */
import type { EmbarqueFasesInput, FaseId } from "./embarqueFasesTipos";

// v13.380.0 — Orden: Arribo → En Aduana → Entregado → EIR → Por liquidar →
// Cerrado. Cada set representa "estados iguales o posteriores a".
const ESTADOS_POST_TRANSITO = new Set([
  "En Tránsito", "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ARRIBO = new Set([
  "Arribo", "En Aduana", "Llegada", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ADUANA = new Set([
  "En Aduana", "Entregado", "EIR", "Por liquidar", "Cerrado",
]);
const ESTADOS_POST_ENTREGADO = new Set(["Entregado", "EIR", "Por liquidar", "Cerrado"]);
const ESTADOS_POST_EIR = new Set(["EIR", "Por liquidar", "Cerrado"]);
const ESTADOS_POST_POR_LIQUIDAR = new Set(["Por liquidar", "Cerrado"]);

export function faseIdParaEstado(estadoVisual: string): FaseId {
  if (estadoVisual === "Cerrado") return "cerrado";
  if (estadoVisual === "Por liquidar") return "por_liquidar";
  if (estadoVisual === "EIR") return "eir";
  if (estadoVisual === "Entregado") return "entregado";
  if (estadoVisual === "En Aduana") return "en_aduana";
  // "Llegada" (deprecado) y "Arribo" se agrupan en la fase de Arribo.
  if (estadoVisual === "Arribo" || estadoVisual === "Llegada") return "arribo";
  if (estadoVisual === "En Tránsito") return "en_transito";
  if (estadoVisual === "Confirmado") return "confirmado";
  return "confirmado";
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface FasesCompletadas {
  cotizacion: boolean;
  transito: boolean;
  arribo: boolean;
  aduana: boolean;
  entregado: boolean;
  eir: boolean;
  porLiquidar: boolean;
  cerrado: boolean;
}

/** Calcula qué fases están completadas. */
export function calcularCompletadas(
  embarque: EmbarqueFasesInput,
  estadoVisual: string,
  esBorrador: boolean,
): FasesCompletadas {
  const etdPasado = !!embarque.etd && new Date(embarque.etd) <= startOfToday();
  return {
    cotizacion: !!embarque.cotizacion_id,
    transito: ESTADOS_POST_TRANSITO.has(estadoVisual) || (!esBorrador && etdPasado),
    arribo: !esBorrador
      && (!!embarque.fecha_llegada_real || ESTADOS_POST_ARRIBO.has(estadoVisual)),
    aduana: ESTADOS_POST_ADUANA.has(estadoVisual),
    entregado: ESTADOS_POST_ENTREGADO.has(estadoVisual),
    eir: ESTADOS_POST_EIR.has(estadoVisual),
    porLiquidar: ESTADOS_POST_POR_LIQUIDAR.has(estadoVisual),
    cerrado: estadoVisual === "Cerrado",
  };
}
