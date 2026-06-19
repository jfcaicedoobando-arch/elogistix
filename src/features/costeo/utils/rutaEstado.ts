/**
 * Lógica derivada del estado real de una ruta de costeo.
 *
 * El flag `activa` en BD es manual; el estado mostrado al usuario combina
 * ese flag con la presencia de tarifas vigentes y la proximidad de expiración.
 */
import type { CosteoRuta } from "@/features/costeo/types";

export type RutaEstadoTone = "success" | "warning" | "destructive" | "muted";

export interface RutaEstadoMeta {
  /** Estado canónico para filtros y ordenamiento. */
  key: "activa" | "sin_tarifa" | "por_vencer" | "inactiva";
  label: string;
  tone: RutaEstadoTone;
  /** Orden relativo: menor = aparece primero (problemas arriba). */
  sortOrder: number;
}

/** Días considerados "por vencer" antes de la fecha de fin de vigencia. */
export const DIAS_POR_VENCER = 7;

function diasHasta(fechaIso: string | null | undefined): number | null {
  if (!fechaIso) return null;
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  const fin = new Date(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(fin.getTime())) return null;
  return Math.floor((fin.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeRutaEstado(ruta: CosteoRuta): RutaEstadoMeta {
  const count = ruta.tarifas_vigentes_count ?? 0;
  if (!ruta.activa) {
    return { key: "inactiva", label: "Inactiva", tone: "muted", sortOrder: 4 };
  }
  if (count === 0) {
    return { key: "sin_tarifa", label: "Sin tarifa", tone: "destructive", sortOrder: 1 };
  }
  const dias = diasHasta(ruta.proxima_expiracion);
  if (dias !== null && dias <= DIAS_POR_VENCER) {
    return {
      key: "por_vencer",
      label: dias < 0 ? "Vencida" : `Vence en ${dias}d`,
      tone: "warning",
      sortOrder: 2,
    };
  }
  return { key: "activa", label: "Activa", tone: "success", sortOrder: 3 };
}

/** Diferencia en días hasta `proxima_expiracion` (negativo = ya vencida). */
export function diasParaExpirar(ruta: CosteoRuta): number | null {
  return diasHasta(ruta.proxima_expiracion);
}
