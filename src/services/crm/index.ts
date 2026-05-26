/**
 * Servicio CRM: barrel re-export. La I/O se divide en módulos por dominio.
 * Componentes y páginas NO deben llamar a supabase directamente.
 */
export * from "./oportunidadCotizaciones";
export * from "./lineage";
export * from "./leaderboard";
export * from "./cotizacionDesdeOportunidad";
export * from "./cotizacionesSinRespuesta";
export * from "./actividades";
export * from "./comentarios";
export * from "./plantillas";
export * from "./etapas";
export * from "./notificaciones";
