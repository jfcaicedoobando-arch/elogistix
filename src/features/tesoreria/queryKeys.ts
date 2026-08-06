export const tesoreria = {
  all: ["tesoreria"] as const,
  cuentas: (activas?: boolean) => ["tesoreria", "cuentas", activas] as const,
  saldosCuentas: ["tesoreria", "saldos-cuentas"] as const,
  saldosCuentasPorOrg: (organizationId: string | null) =>
    ["tesoreria", "saldos-cuentas", organizationId ?? "none"] as const,
  candidatos: (movId?: string | null) => ["tesoreria", "candidatos", movId] as const,
  /** FIX C3c: resumen de conciliación agregado en el servidor. */
  conciliacionResumen: (cuentaId: string | null) =>
    ["tesoreria", "conciliacion-resumen", cuentaId ?? "none"] as const,

  movimientos: (cuentaId: string | null, filtros?: unknown) =>
    ["tesoreria", "movimientos", cuentaId, filtros ?? null] as const,
  /** Conteo de movimientos sin conciliar de toda la organización. */
  movimientosPendientes: (organizationId: string | null) =>
    ["tesoreria", "movimientos-pendientes", organizationId ?? "none"] as const,
  resumen: (organizationId?: string | null) =>
    ["tesoreria", "resumen", organizationId] as const,
  flujoProyectado: (dias = 90) =>
    ["tesoreria", "flujo-proyectado", dias] as const,
  flujoProyectadoPorOrg: (dias: number, organizationId: string | null) =>
    ["tesoreria", "flujo-proyectado", dias, organizationId ?? "none"] as const,
  pagosProgramables: ["tesoreria", "pagos-programables"] as const,
} as const;
