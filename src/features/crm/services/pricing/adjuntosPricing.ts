/**
 * Adjuntos (archivos y capturas) de una Solicitud a Pricing.
 * Viven en el bucket privado `crm-pricing-adjuntos` bajo {org}/{solicitud}/.
 * Solicitante y Pricing los ven por URL firmada temporal.
 */
import { supabase } from "@/integrations/supabase/client";

export const BUCKET_ADJUNTOS_PRICING = "crm-pricing-adjuntos";
export const MAX_ADJUNTO_BYTES = 10 * 1024 * 1024;
const MAX_LISTA = 100;

export interface AdjuntoPricing {
  path: string;
  nombre: string;
  tamano: number;
  esImagen: boolean;
  creado: string | null;
}

const carpeta = (orgId: string, solicitudId: string) => `${orgId}/${solicitudId}`;

function limpiarNombre(nombre: string): string {
  const base = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "archivo";
}

/** Quita el prefijo de tiempo (`1712345678901-`) que evita choques de nombre. */
const nombreVisible = (n: string) => n.replace(/^\d{13}-/, "");

export async function listarAdjuntos(orgId: string, solicitudId: string): Promise<AdjuntoPricing[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ADJUNTOS_PRICING)
    .list(carpeta(orgId, solicitudId), { limit: MAX_LISTA, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.id)
    .map((f) => ({
      path: `${carpeta(orgId, solicitudId)}/${f.name}`,
      nombre: nombreVisible(f.name),
      tamano: Number((f.metadata as { size?: number } | null)?.size ?? 0),
      esImagen: /^image\//.test(String((f.metadata as { mimetype?: string } | null)?.mimetype ?? "")),
      creado: f.created_at ?? null,
    }));
}

export async function subirAdjunto(orgId: string, solicitudId: string, file: File): Promise<void> {
  if (file.size > MAX_ADJUNTO_BYTES) throw new Error(`"${file.name}" pesa más de 10 MB.`);
  const path = `${carpeta(orgId, solicitudId)}/${Date.now()}-${limpiarNombre(file.name)}`;
  const { error } = await supabase.storage
    .from(BUCKET_ADJUNTOS_PRICING)
    .upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
}

export async function urlAdjunto(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_ADJUNTOS_PRICING).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function borrarAdjunto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_ADJUNTOS_PRICING).remove([path]);
  if (error) throw error;
}
