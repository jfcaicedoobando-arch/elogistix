/**
 * Agregado de tarifas por ruta (conteo, proveedores, vencimiento). Usa el
 * mismo predicado que catálogo/KPIs (`esTarifaUsableEn`): aprobada, no
 * reemplazada y `vigente_desde <= hoy <= vigente_hasta`.
 */
import { esTarifaUsableEn } from "./vigenciaTarifa";

export interface TarifaRutaAgregable {
  estado: string;
  estado_aprobacion?: string | null;
  vigente_desde?: string | null;
  vigente_hasta: string | null;
  updated_at: string | null;
  agente_id: string | null;
}

export interface AgregadoRuta {
  tarifas_vigentes_count: number;
  proxima_expiracion: string | null;
  ultima_actualizacion_tarifa: string | null;
  proveedores_count: number;
}

/** Sin fecha final = abierta (compatibilidad con registros legacy). */
const SIN_FIN = "9999-12-31";

export function esTarifaRutaUsable(t: TarifaRutaAgregable, hoy: string): boolean {
  return t.estado === "vigente" && esTarifaUsableEn({
    estado: t.estado,
    estado_aprobacion: t.estado_aprobacion ?? undefined,
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta ?? SIN_FIN,
  }, hoy);
}

export function agregarTarifasRuta(
  tarifas: ReadonlyArray<TarifaRutaAgregable>,
  hoy: string,
): AgregadoRuta {
  const vigentes = tarifas.filter((t) => esTarifaRutaUsable(t, hoy));
  const fechasFin = vigentes.map((t) => t.vigente_hasta).filter((d): d is string => !!d).sort();
  const updates = vigentes.map((t) => t.updated_at).filter((d): d is string => !!d).sort();
  const agentes = new Set(vigentes.map((t) => t.agente_id).filter(Boolean));
  return {
    tarifas_vigentes_count: vigentes.length,
    proxima_expiracion: fechasFin[0] ?? null,
    ultima_actualizacion_tarifa: updates[updates.length - 1] ?? null,
    proveedores_count: agentes.size,
  };
}
