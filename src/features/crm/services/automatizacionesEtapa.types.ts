/**
 * Tipos de las automatizaciones de etapa — extraídos de
 * `automatizacionesEtapa.ts` (Power of 10: ≤200 líneas). Sin cambios de forma.
 */
export interface EtapaInfo {
  id: string;
  nombre: string;
  tipo: "abierta" | "ganada" | "perdida";
  probabilidad_default: number;
  crea_tarea_seguimiento: boolean;
  dias_seguimiento: number;
}

export interface OportunidadMin {
  id: string;
  nombre: string;
  vendedor_id: string | null;
  vendedor_email: string;
  cliente_nombre: string;
}

export interface AutomationCtx {
  etapa: EtapaInfo;
  op: OportunidadMin;
  responsableId: string | null;
  responsableEmail: string;
  userId: string | null;
}
