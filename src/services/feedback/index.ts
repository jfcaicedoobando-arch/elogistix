import { supabase } from "@/integrations/supabase/client";
import type {
  ReporteFeedback,
  ComentarioFeedback,
  TipoReporteFeedback,
  EstadoReporteFeedback,
  ReporteFeedbackMetadata,
} from "@/types/feedback";

const BUCKET = "reportes-feedback";

export interface CrearReporteInput {
  tipo: TipoReporteFeedback;
  titulo: string;
  descripcion: string;
  url: string;
  elementoSelector: string | null;
  elementoTexto: string | null;
  metadata: ReporteFeedbackMetadata;
  imagenes: File[];
  usuarioId: string;
  usuarioEmail: string;
  organizationId: string | null;
  rolReportero: string | null;
}

export async function crearReporte(input: CrearReporteInput): Promise<ReporteFeedback> {
  const reporteId = crypto.randomUUID();
  const paths: string[] = [];

  for (let i = 0; i < input.imagenes.length; i++) {
    const file = input.imagenes[i];
    const ext = (file.name.split(".").pop() || "png").toLowerCase().slice(0, 5);
    const path = `${input.usuarioId}/${reporteId}/${String(i).padStart(2, "0")}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });
    if (upErr) throw upErr;
    paths.push(path);
  }

  const { data, error } = await supabase
    .from("reportes_feedback")
    .insert([{
      id: reporteId,
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion,
      url: input.url,
      elemento_selector: input.elementoSelector,
      elemento_texto: input.elementoTexto,
      metadata: input.metadata as never,
      imagenes: paths,
      usuario_id: input.usuarioId,
      usuario_email: input.usuarioEmail,
      organization_id: input.organizationId,
      rol_reportero: input.rolReportero,
    }])
    .select()
    .single();
  if (error) throw error;
  return data as ReporteFeedback;
}

export interface ListarReportesFiltros {
  tipo?: TipoReporteFeedback | "todos";
  estado?: EstadoReporteFeedback | "todos";
  organizationId?: string | "todos";
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listarReportes(f: ListarReportesFiltros) {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase
    .from("reportes_feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (f.tipo && f.tipo !== "todos") q = q.eq("tipo", f.tipo);
  if (f.estado && f.estado !== "todos") q = q.eq("estado", f.estado);
  if (f.organizationId && f.organizationId !== "todos") q = q.eq("organization_id", f.organizationId);
  if (f.search && f.search.trim()) {
    const s = f.search.trim().replace(/[%,]/g, "");
    q = q.or(`titulo.ilike.%${s}%,descripcion.ilike.%${s}%,usuario_email.ilike.%${s}%`);
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return { data: (data ?? []) as ReporteFeedback[], total: count ?? 0 };
}

export async function obtenerReporte(id: string): Promise<ReporteFeedback> {
  const { data, error } = await supabase.from("reportes_feedback").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ReporteFeedback;
}

export async function actualizarEstadoReporte(id: string, estado: EstadoReporteFeedback) {
  const { error } = await supabase.from("reportes_feedback").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function eliminarReporte(id: string) {
  const { error } = await supabase.from("reportes_feedback").delete().eq("id", id);
  if (error) throw error;
}

export async function listarComentarios(reporteId: string): Promise<ComentarioFeedback[]> {
  const { data, error } = await supabase
    .from("reportes_feedback_comentarios")
    .select("*")
    .eq("reporte_id", reporteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ComentarioFeedback[];
}

export async function agregarComentario(input: {
  reporteId: string;
  autorId: string;
  autorEmail: string;
  autorEsAdmin: boolean;
  contenido: string;
}) {
  const { error } = await supabase.from("reportes_feedback_comentarios").insert({
    reporte_id: input.reporteId,
    autor_id: input.autorId,
    autor_email: input.autorEmail,
    autor_es_admin: input.autorEsAdmin,
    contenido: input.contenido,
  });
  if (error) throw error;
}

export async function listarMisReportes(usuarioId: string): Promise<ReporteFeedback[]> {
  const { data, error } = await supabase
    .from("reportes_feedback")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as ReporteFeedback[];
}

export async function getImagenSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
