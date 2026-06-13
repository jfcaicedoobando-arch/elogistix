export const dashboardEjecutivo = {
  all: ["dashboard-ejecutivo"] as const,
  snapshot: (organizationId: string | null | undefined, periodo: string) =>
    ["dashboard-ejecutivo", "snapshot", organizationId ?? null, periodo] as const,
} as const;
