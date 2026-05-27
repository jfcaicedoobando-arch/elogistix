export const facturacion = {
  hueco: (organizationId?: string | null) => ['facturacion', 'hueco', organizationId] as const,
  proyeccion: (organizationId: string | null | undefined, mesKey: string) =>
    ['facturacion', 'proyeccion', organizationId, mesKey] as const,
} as const;
