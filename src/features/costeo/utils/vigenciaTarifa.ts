/**
 * Lógica pura de vigencia de tarifas marítimas — extraída para reutilizar
 * entre operaciones (`TarifaEstadoUnificado`) y el portal del agente, y para
 * poder testearla sin montar componentes.
 *
 * Bug corregido: una tarifa en `estado_aprobacion='borrador'` con
 * `vigente_hasta` en el pasado se mostraba como "Pendiente" sin ninguna
 * advertencia, y el guard de aprobación no la bloqueaba.
 */
import { formatFechaDia } from "@/lib/formatters";

export type EstadoCanonicoTarifa = "Rechazada" | "Pendiente" | "Reemplazada" | "Vencida" | "Vigente";

export interface VigenciaTarifaInput {
  /** `estado_aprobacion` de la tarifa: 'borrador' | 'vigente' | 'rechazada'. */
  estadoAprobacion?: string;
  /** `estado` técnico (puede venir pre-calculado como 'reemplazada'/'vencida'). */
  estado?: string;
  /** `vigente_hasta`, date-only `YYYY-MM-DD`. */
  vigenteHasta: string;
  /** Día de negocio México, `YYYY-MM-DD` (usar `todayLocalISO()`). */
  hoy: string;
}

export interface VigenciaTarifaResultado {
  estadoCanonico: EstadoCanonicoTarifa;
  /** `true` si `vigenteHasta < hoy`, sin importar el estado de aprobación. */
  vencida: boolean;
  /** Texto breve a mostrar cuando la tarifa está pendiente pero ya venció. */
  advertencia?: string;
}

/** `true` si la vigencia ya pasó (vence HOY no cuenta como vencida). */
export function esVigenciaVencida(vigenteHasta: string, hoy: string): boolean {
  return vigenteHasta < hoy;
}

/**
 * Resuelve el estado canónico de una tarifa combinando aprobación + vigencia.
 * Un borrador vencido sigue mostrándose como "Pendiente" (no cambia el flujo
 * de aprobación), pero trae `vencida: true` + `advertencia` para que la UI
 * avise y el guard de aprobación pueda bloquearla.
 */
export function resolverEstadoVigenciaTarifa(input: VigenciaTarifaInput): VigenciaTarifaResultado {
  const ap = input.estadoAprobacion ?? "vigente";
  const vencida = esVigenciaVencida(input.vigenteHasta, input.hoy);

  if (ap === "rechazada") return { estadoCanonico: "Rechazada", vencida };

  if (ap === "borrador") {
    return {
      estadoCanonico: "Pendiente",
      vencida,
      advertencia: vencida
        ? `Pendiente · vigencia vencida el ${formatFechaDia(input.vigenteHasta)}`
        : undefined,
    };
  }

  if (input.estado === "reemplazada") return { estadoCanonico: "Reemplazada", vencida };
  if (vencida || input.estado === "vencida") return { estadoCanonico: "Vencida", vencida: true };
  return { estadoCanonico: "Vigente", vencida: false };
}

/**
 * Guard de negocio: una tarifa vencida (por fecha) nunca se puede aprobar,
 * sin importar si su `estado` técnico ya se recalculó a 'vencida'.
 */
export function puedeAprobarTarifa(input: Pick<VigenciaTarifaInput, "vigenteHasta" | "hoy">): boolean {
  return !esVigenciaVencida(input.vigenteHasta, input.hoy);
}

export const MENSAJE_VIGENCIA_VENCIDA =
  "No puedes aprobar una tarifa con vigencia vencida: pide al agente actualizar la vigencia y volver a enviarla.";
