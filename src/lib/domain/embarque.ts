/**
 * Reglas de dominio puras para Embarques.
 * Sin dependencias de Supabase, React Query ni UI.
 */

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
