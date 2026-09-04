/**
 * Cálculos puros de higiene y cobertura comercial (Etapas 2 y 3 CRM Hunter).
 */
import type { HigieneOportunidad, EstadoHigiene } from "@/features/crm/services/higiene";
import type { Moneda } from "@/types/db";
import type { PresupuestoMes } from "@/features/crm/services/metasPresupuesto";

export const ETIQUETA_HIGIENE: Record<EstadoHigiene, string> = {
  en_tiempo: "En tiempo",
  por_vencer: "Por vencer",
  vencida: "Vencida",
};

export const VARIANTE_HIGIENE: Record<EstadoHigiene, "default" | "secondary" | "destructive"> = {
  en_tiempo: "default",
  por_vencer: "secondary",
  vencida: "destructive",
};

/** Presupuesto del mes indicado (1-12) conservando su moneda; 0 MXN si no está capturado. */
export interface PresupuestoDelMes {
  monto: number;
  moneda: Moneda;
}

export function presupuestoDelMes(
  filas: PresupuestoMes[] | undefined,
  mes: number,
): PresupuestoDelMes {
  const fila = filas?.find((f) => f.mes === mes);
  return { monto: fila?.monto ?? 0, moneda: fila?.moneda ?? "MXN" };
}

/**
 * Cobertura = pipeline ponderado (siempre MXN) / presupuesto del mes.
 * `null` cuando no hay presupuesto capturado (evita dividir entre cero) o
 * cuando el presupuesto está en moneda extranjera: sin un tipo de cambio
 * histórico válido, dividir MXN entre USD/EUR daría un porcentaje engañoso.
 */
export function coberturaPonderada(
  pipelinePonderado: number,
  presupuesto: PresupuestoDelMes,
): number | null {
  if (presupuesto.moneda !== "MXN") return null;
  if (presupuesto.monto <= 0) return null;
  return pipelinePonderado / presupuesto.monto;
}

export interface ConteoHigiene {
  en_tiempo: number;
  por_vencer: number;
  vencida: number;
}

export function contarPorEstado(filas: HigieneOportunidad[]): ConteoHigiene {
  const base: ConteoHigiene = { en_tiempo: 0, por_vencer: 0, vencida: 0 };
  for (const fila of filas) base[fila.estado_higiene] += 1;
  return base;
}

/** Ordena por urgencia: vencidas primero, luego mayor retraso. */
export function ordenarPorUrgencia(filas: HigieneOportunidad[]): HigieneOportunidad[] {
  const peso: Record<EstadoHigiene, number> = { vencida: 0, por_vencer: 1, en_tiempo: 2 };
  return [...filas].sort((a, b) => {
    const diff = peso[a.estado_higiene] - peso[b.estado_higiene];
    if (diff !== 0) return diff;
    return b.dias_sin_movimiento - a.dias_sin_movimiento;
  });
}
