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
  | "proforma_vencida"
  | "embarque_huerfano";

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
