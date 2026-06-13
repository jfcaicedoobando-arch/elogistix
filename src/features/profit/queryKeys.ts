export const profit = {
  estadoResultados: (organizationId: string | null | undefined, mesKey: string) =>
    ['profit', 'estado-resultados', organizationId, mesKey] as const,
} as const;
