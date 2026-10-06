/** Metadatos y resultados separados para invalidar sólo el trabajo afectado. */
export const crmReportesKeys = {
  all: ["crm", "reportes"] as const,
  tableros: ["crm", "reportes", "tableros"] as const,
  listas: ["crm", "reportes", "lista"] as const,
  lista: (tableroId: string | null) => ["crm", "reportes", "lista", tableroId] as const,
  datos: (reporteId: string) => ["crm", "reportes", "datos", reporteId] as const,
};

export const crmPricingKeys = {
  all: ["crm", "pricing"] as const,
  tarifas: ["crm", "pricing", "tarifas"] as const,
  usuarios: ["crm", "pricing", "usuarios"] as const,
  bandejas: ["crm", "pricing", "bandeja"] as const,
  bandeja: (estado: string, pagina: number) => ["crm", "pricing", "bandeja", estado, pagina] as const,
  oportunidad: (id: string) => ["crm", "pricing", "oportunidad", id] as const,
  solicitud: (id: string | null) => ["crm", "pricing", "solicitud", id] as const,
  opciones: (id: string | null) => ["crm", "pricing", "opciones", id] as const,
  tarifasRespuesta: (id: string) => ["crm", "pricing", "tarifas-respuesta", id] as const,
};
