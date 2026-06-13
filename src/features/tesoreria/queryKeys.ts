export const tesoreria = {
  all: ["tesoreria"] as const,
  cuentas: ["tesoreria", "cuentas"] as const,
  movimientos: (cuentaId: string | null, filtros?: unknown) =>
    ["tesoreria", "movimientos", cuentaId, filtros ?? null] as const,
  resumen: (organizationId?: string | null) =>
    ["tesoreria", "resumen", organizationId] as const,
  flujoProyectado: (dias = 90) =>
    ["tesoreria", "flujo-proyectado", dias] as const,
} as const;
