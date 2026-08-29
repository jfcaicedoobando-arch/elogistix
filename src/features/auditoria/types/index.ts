/**
 * Tipos compartidos del dominio Auditoría operativa.
 * Importables tanto desde hooks, services como UI.
 */

export type ReglaAuditoria =
  | "docs_faltantes"
  | "docs_pendientes_avanzado"
  | "fechas"
  | "ventas_sin_facturar"
  | "margen_negativo"
  | "margen_bajo"
  | "venta_sin_costo"
  | "costo_sin_venta"
  | "costos_repetidos"
  | "proforma_vencida"
  | "proforma_borrador_abandonada"
  | "proforma_inconsistente"
  | "embarque_huerfano"
  // Fase 2 — Reglas fiscales (FacturAPI)
  | "factura_sin_timbrar"
  | "rep_pendiente"
  | "factura_cancelada_sin_sustitucion"
  // Fase 2B — Cobranza (CXC) y Compras (CXP)
  | "cxc_vencida"
  | "cxp_por_capturar_estancada"
  | "cxp_vencida"
  // AUD-1 (v13.235.0) — Reglas basadas en `embarque_contenedores`
  | "contenedor_datos_incompletos"
  | "contenedor_fechas_incompletas"
  // AUD-2 (v13.288.0) — Fallback explícito cuando falta el tipo de cambio
  | "tipo_cambio_faltante"
  // M-10 (auditoría v14) — total de línea ≠ cantidad × precio
  | "venta_total_descuadrado"
  // M-10 (re-auditoría v15) — carátula del embarque ≠ suma de contenedores
  | "contenedores_totales_descuadrados";

export type SeveridadAuditoria = "critico" | "alto" | "medio";

export interface HallazgoAuditoria {
  embarque_id: string;
  expediente: string;
  cliente_nombre: string;
  modo: string;
  estado: string;
  eta: string | null;
  regla: ReglaAuditoria;
  severidad: SeveridadAuditoria;
  detalle: string;
  documentos_faltantes: string[];
  /** Monto MXN asociado (sólo lo entregan reglas financieras nuevas). */
  monto_mxn?: number;
}

export interface AuditoriaUmbrales {
  margen_minimo_pct: number;
  dias_proforma_vencida: number;
  dias_huerfano: number;
}

export interface ReporteAuditoria {
  generated_at: string;
  total_hallazgos: number;
  por_severidad: { critico: number; alto: number; medio: number };
  por_regla: Record<ReglaAuditoria, number>;
  /** Umbrales aplicados por la RPC al evaluar reglas configurables. */
  umbrales?: AuditoriaUmbrales;
  hallazgos: HallazgoAuditoria[];
}

export type EstadoHallazgoRevision = "pendiente" | "en_progreso" | "revisado";

export interface AuditoriaRevision {
  id: string;
  embarque_id: string;
  regla: string;
  detalle_hash: string;
  detalle: string;
  accion_tomada: string | null;
  revisado_por: string | null;
  revisado_por_email: string | null;
  /** Workflow: pendiente | en_progreso | revisado. */
  estado_revision: EstadoHallazgoRevision;
  /** Responsable asignado (operador/encargado). */
  responsable_id: string | null;
  responsable_email: string | null;
  /** Quién hizo la asignación y cuándo. */
  asignado_por: string | null;
  asignado_por_email: string | null;
  asignado_at: string | null;
  /** Fecha objetivo de resolución. */
  fecha_limite: string | null;
  /** Snooze: fecha hasta la que el hallazgo se oculta de pendientes. */
  snoozed_until: string | null;
  snooze_motivo: string | null;
  /**
   * Momento exacto en que el hallazgo se marcó como revisado. Llenado
   * automáticamente por el trigger `set_auditoria_revisado_at` cuando
   * `estado_revision` pasa a 'revisado'. Usar este campo (NO `updated_at`)
   * para calcular MTTR — `updated_at` cambia con cualquier modificación
   * (comentarios, snooze, reasignación) y distorsiona la métrica.
   */
  revisado_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditoriaComentario {
  id: string;
  revision_id: string;
  autor_id: string;
  autor_email: string;
  contenido: string;
  created_at: string;
}

export interface AuditoriaSnapshot {
  id: string;
  organization_id: string;
  fecha: string;
  total_hallazgos: number;
  total_pendientes: number;
  criticos: number;
  altos: number;
  medios: number;
  score: number;
  por_regla: Record<string, number>;
  created_at: string;
}
