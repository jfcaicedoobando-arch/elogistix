export const presupuesto = {
  all: ["presupuesto"] as const,
  categorias: (activas?: boolean) =>
    ["presupuesto", "categorias", activas ?? null] as const,
  mensual: (anio: number) => ["presupuesto", "mensual", anio] as const,
  mensualPorOrg: (anio: number, organizationId: string | null) =>
    ["presupuesto", "mensual", anio, organizationId ?? "none"] as const,
  vsReal: (periodo: string) => ["presupuesto", "vs-real", periodo] as const,
} as const;
