/** Contratos puros de higiene del pipeline comercial. */
export type EstadoHigiene = "en_tiempo" | "por_vencer" | "vencida";

export interface HigieneResumen {
  abiertas: number;
  registros_completos: number;
  higiene_pct: number;
  seguimiento_oportuno_pct: number;
  vencidas: number;
  sin_actividad_programada: number;
  pipeline_bruto: number;
  pipeline_ponderado: number;
  /** UI-15: fecha del T/C DOF usado para convertir el pipeline a MXN. */
  tc_fecha: string | null;
  /** UI-15: true si quedaron montos en moneda extranjera sin T/C publicado. */
  tc_estimado: boolean;
}

export interface HigieneOportunidad {
  id: string;
  nombre: string;
  cliente_nombre: string | null;
  etapa_id: string;
  etapa_nombre: string;
  vendedor_email: string | null;
  monto_estimado: number | null;
  moneda: string | null;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
  ultimo_movimiento_at: string;
  dias_sin_movimiento: number;
  sla_dias: number;
  estado_higiene: EstadoHigiene;
  registro_completo: boolean;
  proxima_actividad_at: string | null;
  actividad_vencida: boolean;
}
