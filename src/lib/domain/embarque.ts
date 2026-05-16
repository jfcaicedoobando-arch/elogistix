/**
 * Lógica pura de dominio de embarques.
 * Sin dependencias de Supabase, React Query ni UI.
 * Ubicación canónica desde Fase 8.
 */

// ============================================================
// Cálculo del estado visual de un embarque
// ============================================================

export function calcularEstadoEmbarque(
  modo: string,
  tipo: string,
  etd: string | null,
  eta: string | null,
  estadoActual: string,
): string {
  const ESTADOS_MANUALES = ["Arribo", "En Aduana", "Entregado", "EIR", "Cerrado"];
  if (ESTADOS_MANUALES.includes(estadoActual)) return estadoActual;

  // Solo calcula automático para importaciones marítimas
  if (modo !== "Marítimo" || tipo !== "Importación") return estadoActual;
  if (!etd || !eta) return estadoActual;

  // Comparar fechas en UTC para coincidir con `current_date` del backend
  // (Postgres en UTC). Evita desfases por zona horaria del navegador donde
  // hoy local = ayer UTC y un embarque con ETA "hoy UTC" se contaría como
  // En Tránsito en el frontend pero como Arribo en el dashboard server-side.
  const now = new Date();
  const hoy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fechaETD = new Date(etd + "T00:00:00Z");
  const fechaETA = new Date(eta + "T00:00:00Z");

  if (hoy < fechaETD) return "Confirmado";
  if (hoy >= fechaETD && hoy < fechaETA) return "En Tránsito";
  if (hoy >= fechaETA) return "Arribo";

  return estadoActual;
}

// ============================================================
// Reglas para registro automático de eventos de tracking al cambiar estado
// ============================================================

/**
 * Mapeo de estado de embarque al tipo de evento de tracking que se debe registrar
 * automáticamente cuando el estado cambia.
 */
export const ESTADO_A_EVENTO_TRACKING: Record<string, string> = {
  Confirmado: "Otro",
  "En Tránsito": "Zarpe",
  Arribo: "Arribo a Puerto",
  "En Aduana": "Despacho Aduanal",
  Entregado: "Entrega",
  EIR: "Liberación",
  Cerrado: "Otro",
};

/**
 * Devuelve el tipo de evento de tracking que corresponde a un estado dado.
 * Cae a "Otro" para estados desconocidos.
 */
export function tipoEventoParaEstado(estado: string): string {
  return ESTADO_A_EVENTO_TRACKING[estado] ?? "Otro";
}

/**
 * Construye la descripción estándar del evento de tracking generado al cambiar
 * de estado un embarque.
 */
export function descripcionEventoCambioEstado(nuevoEstado: string): string {
  return `Estado cambiado a "${nuevoEstado}"`;
}
