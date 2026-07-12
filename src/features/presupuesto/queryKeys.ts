export const presupuesto = {
  all: ["presupuesto"] as const,
  categorias: (activas?: boolean) =>
    ["presupuesto", "categorias", activas ?? null] as const,
  mensual: (anio: number) => ["presupuesto", "mensual", anio] as const,
  vsReal: (periodo: string) => ["presupuesto", "vs-real", periodo] as const,
} as const;
