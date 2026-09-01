/**
 * Lógica pura para `useCliente360`: agrega totales abierto/ganado
 * a partir de las oportunidades + tipo de etapa, separados por moneda
 * (no se suman monedas distintas: no hay TC histórico canónico).
 */

import type { EtapaTipo } from "./forecast";

export interface OportunidadCliente360Row {
  etapa_id: string | null;
  monto_estimado: number | string | null;
  valor_real: number | string | null;
  moneda?: string | null;
}

export interface Cliente360TotalesMoneda {
  moneda: string;
  totalAbierto: number;
  totalGanado: number;
}

export function computeCliente360Totals(
  oportunidades: OportunidadCliente360Row[],
  etapaTipos: Map<string, EtapaTipo>,
): Cliente360TotalesMoneda[] {
  const porMoneda = new Map<string, Cliente360TotalesMoneda>();
  for (const o of oportunidades) {
    const moneda = o.moneda || "MXN";
    const entry = porMoneda.get(moneda) ?? { moneda, totalAbierto: 0, totalGanado: 0 };
    const t = o.etapa_id ? etapaTipos.get(o.etapa_id) : undefined;
    const monto = Number(o.monto_estimado ?? 0) || 0;
    const realOrEst = Number(o.valor_real ?? o.monto_estimado ?? 0) || 0;
    if (t === "abierta") entry.totalAbierto += monto;
    if (t === "ganada") entry.totalGanado += realOrEst;
    porMoneda.set(moneda, entry);
  }
  return Array.from(porMoneda.values()).sort((a, b) => a.moneda.localeCompare(b.moneda));
}
