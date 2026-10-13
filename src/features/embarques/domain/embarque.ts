/**
 * Lógica pura de dominio de embarques.
 * Sin dependencias de Supabase, React Query ni UI.
 * Ubicación canónica desde Fase 8.
 */

// ============================================================
// Cálculo del estado visual de un embarque
// ============================================================

// eslint-disable-next-line max-params -- Firma consumida por >15 callers; refactor a options object es un cambio invasivo separado.
export function calcularEstadoEmbarque(
  modo: string,
  tipo: string,
  etd: string | null,
  eta: string | null,
  estadoActual: string,
  fechaLlegadaReal?: string | null,
): string {
  // Las fechas estimadas no acreditan una salida. Confirmado sólo avanza
  // por la acción explícita del operador; tampoco retrocedemos un zarpe
  // registrado cuando se corrige la ETD hacia una fecha futura.
  if (estadoActual !== "En Tránsito") return estadoActual;
  if (modo !== "Marítimo" || tipo !== "Importación") return estadoActual;
  if (!etd || !eta || !fechaLlegadaReal) return estadoActual;

  // Conserva la sincronización de arribo respaldada por llegada real.
  // La firma sigue estable para todos los consumidores de estado visual.
  const now = new Date();
  const hoy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const fechaETA = new Date(eta + "T00:00:00Z");
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
  "Por liquidar": "Otro",
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
