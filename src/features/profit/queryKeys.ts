export const profit = {
  all: ["profit"] as const,
  estadoResultados: (
    organizationId: string | null | undefined,
    mesKey: string,
    fuente?: string,
  ) => ['profit', 'estado-resultados', organizationId, mesKey, fuente] as const,
} as const;
