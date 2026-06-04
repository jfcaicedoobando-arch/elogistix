/**
 * Helpers puros para `MiOperacionSection`. Sin dependencias de React.
 */
import type { AlertaDemora, ProximoArribo } from "@/hooks/dashboard";

export interface Pendiente {
  id: string;
  expediente: string;
  cliente_nombre: string;
  motivo: string;
  badge: string;
}

export function buildPendientes(
  alertas: AlertaDemora[],
  arribos: ProximoArribo[],
): Pendiente[] {
  const out: Pendiente[] = [];
  for (const a of alertas) {
    out.push({
      id: a.id,
      expediente: a.expediente,
      cliente_nombre: a.cliente_nombre,
      motivo: "Demora — confirmar arribo",
      badge: `${a.diasDemora}d`,
    });
  }
  for (const a of arribos) {
    if (a.diasRestantes > 1) continue;
    if (out.some((p) => p.id === a.id)) continue;
    out.push({
      id: a.id,
      expediente: a.expediente,
      cliente_nombre: a.cliente_nombre,
      motivo: a.diasRestantes <= 0 ? "Arribo hoy" : "Arribo mañana",
      badge: "ETA",
    });
  }
  return out;
}
