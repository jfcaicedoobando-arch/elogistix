/**
 * Servicio CRM: barrel re-export. La I/O se divide en módulos por dominio:
 * - oportunidadCotizaciones, lineage, leaderboard, cotizacionDesdeOportunidad.
 * Componentes y páginas NO deben llamar a supabase directamente.
 */
export * from "./oportunidadCotizaciones";
export * from "./lineage";
export * from "./leaderboard";
export * from "./cotizacionDesdeOportunidad";
