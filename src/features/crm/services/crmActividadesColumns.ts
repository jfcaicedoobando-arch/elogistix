/**
 * Constantes de columnas para `crm_actividades`. Centraliza el conjunto de
 * campos consumidos por los servicios del feature CRM (Auditoría Paso 7).
 */
export const CRM_ACTIVIDADES_COLUMNS_FULL =
  "id, tipo, asunto, descripcion, entidad_tipo, entidad_id, fecha_programada, fecha_completada, duracion_min, resultado, responsable_id, responsable_email, created_at, updated_at" as const;

export const CRM_ACTIVIDADES_COLUMNS_MIN =
  "id, entidad_tipo, entidad_id, tipo, asunto, fecha_programada" as const;

export const CRM_ACTIVIDADES_COLUMNS_SEARCH =
  "id, asunto, entidad_tipo, entidad_id" as const;
