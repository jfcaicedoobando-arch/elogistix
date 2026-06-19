/**
 * Barrel del dominio puro de CRM. Re-exporta utilidades de forecast,
 * dashboard, oportunidades, leads y next-best-actions. Sin React, sin
 * Supabase. Movido desde `src/lib/crm/` en la auditoría v12.95.10.
 */
export * from "./cliente360";
export * from "../lib/crmToast";
export * from "./dashboardAggregates";
export * from "./forecast";
export * from "./forecastBuckets";
export * from "./leadEditDirty";
export * from "./nextBestActions";
export * from "./oportunidadFormHelpers";
export * from "./oportunidadFormState";
export * from "./oportunidadPayload";
export * from "./proximasActividades";
