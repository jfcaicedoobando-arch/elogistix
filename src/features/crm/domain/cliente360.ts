/**
 * Lógica pura para `useCliente360`: agrega totales abierto/ganado
 * a partir de las oportunidades + tipo de etapa.
 */

import type { EtapaTipo } from "./forecast";

export interface OportunidadCliente360Row {
  etapa_id: string | null;
  monto_estimado: number | string | null;
  valor_real: number | string | null;
}

export interface Cliente360Totales {
  totalAbierto: number;
  totalGanado: number;
}

export function computeCliente360Totals(
  oportunidades: OportunidadCliente360Row[],
  etapaTipos: Map<string, EtapaTipo>,
): Cliente360Totales {
  let totalAbierto = 0;
  let totalGanado = 0;
  for (const o of oportunidades) {
    const t = o.etapa_id ? etapaTipos.get(o.etapa_id) : undefined;
    const monto = Number(o.monto_estimado ?? 0) || 0;
    const realOrEst = Number(o.valor_real ?? o.monto_estimado ?? 0) || 0;
    if (t === "abierta") totalAbierto += monto;
    if (t === "ganada") totalGanado += realOrEst;
  }
  return { totalAbierto, totalGanado };
}
