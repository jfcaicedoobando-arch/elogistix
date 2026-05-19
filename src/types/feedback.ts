import type { Database } from "@/integrations/supabase/types";
import type { Breadcrumb } from "@/lib/feedback/breadcrumbsBuffer";

export type TipoReporteFeedback = Database["public"]["Enums"]["tipo_reporte_feedback"];
export type EstadoReporteFeedback = Database["public"]["Enums"]["estado_reporte_feedback"];

export interface ReporteFeedbackMetadata {
  appVersion?: string;
  userAgent?: string;
  viewport?: string;
  dpr?: number;
  timezone?: string;
  route?: string;
  consoleLogs?: string[];
  breadcrumbs?: Breadcrumb[];
}

export interface ReporteFeedback {
  id: string;
  tipo: TipoReporteFeedback;
  estado: EstadoReporteFeedback;
  titulo: string;
  descripcion: string;
  url: string | null;
  elemento_selector: string | null;
  elemento_texto: string | null;
  metadata: ReporteFeedbackMetadata;
  imagenes: string[];
  usuario_id: string;
  usuario_email: string;
  organization_id: string | null;
  rol_reportero: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComentarioFeedback {
  id: string;
  reporte_id: string;
  autor_id: string;
  autor_email: string;
  autor_es_admin: boolean;
  contenido: string;
  created_at: string;
}

export const ESTADO_FEEDBACK_LABEL: Record<EstadoReporteFeedback, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

export const TIPO_FEEDBACK_LABEL: Record<TipoReporteFeedback, string> = {
  bug: "Bug",
  mejora: "Mejora",
};
