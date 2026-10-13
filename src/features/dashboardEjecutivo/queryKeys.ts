export const dashboardEjecutivo = {
  all: ["dashboard-ejecutivo"] as const,
  snapshot: (
    organizationId: string | null | undefined,
    periodo: string,
    fuente?: string,
  ) => ["dashboard-ejecutivo", "snapshot", organizationId ?? null, periodo, fuente ?? "embarques", "financial-criteria-2026-10-13"] as const,
} as const;
