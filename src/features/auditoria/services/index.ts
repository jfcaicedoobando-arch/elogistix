/**
 * Servicio de auditoría operativa (barrel re-export).
 * Encapsula los RPC/queries de Supabase. Los hooks (`useAuditoria`,
 * `useAuditoriaRevisiones`) solo orquestan cache. Dividido por dominio
 * para mantener archivos ≤200 líneas (Power of 10).
 */
export * from "./reporte";
export * from "./revisiones";
export * from "./comentarios";
export * from "./snooze";
export * from "./snapshots";
