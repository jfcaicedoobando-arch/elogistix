/**
 * Query key factory para el Portal del Agente de Carga.
 */
export const portalAgente = {
  all: ["portal-agente"] as const,
  context: () => ["portal-agente", "context"] as const,
  tarifas: () => ["portal-agente", "tarifas"] as const,
  embarques: () => ["portal-agente", "embarques"] as const,
  rutas: (organizationId: string | null | undefined) =>
    ["portal-agente", "rutas", organizationId] as const,
} as const;
