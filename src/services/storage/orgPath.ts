/**
 * v13.420.0 (Sentry JAVASCRIPT-REACT-4M) — Constructores de rutas del bucket
 * `documentos` con la organización efectiva como carpeta raíz.
 *
 * Analogía: cada organización tiene su propio archivero. Antes se guardaban
 * carpetas sueltas (`embarques/msds`, `cotizaciones/…`) que el candado del
 * archivero (RLS) no reconocía y rechazaba la subida.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, sanitizeStorageKey } from "@/lib/storage";

/** Resuelve la organización efectiva del usuario (incluye impersonación). */
export async function resolverOrgIdActual(): Promise<string> {
  const { data, error } = await supabase.rpc("current_user_org_id");
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo determinar la organización activa para guardar el archivo.",
    );
  }
  return data;
}

/** `{org}/msds/{timestamp}_{archivo}` — MSDS de embarque o cotización. */
export async function buildMsdsPath(fileName: string): Promise<string> {
  const org = await resolverOrgIdActual();
  return `${org}/msds/${Date.now()}_${sanitizeFileName(fileName)}`;
}

/** `{org}/cotizaciones/{cotizacionRef}/{timestamp}_{archivo}` */
export async function buildCotizacionDocPath(
  cotizacionRef: string,
  fileName: string,
): Promise<string> {
  const org = await resolverOrgIdActual();
  const ref = sanitizeStorageKey(cotizacionRef);
  return `${org}/cotizaciones/${ref}/${Date.now()}_${sanitizeFileName(fileName)}`;
}

/**
 * `{org}/embarques/{expediente}/{docNombre}/{timestamp}_{archivo}`
 *
 * Se usa en el alta de embarque, donde los archivos se suben ANTES de crear
 * la fila del embarque: la carpeta de organización sí existe desde el inicio.
 */
export async function buildEmbarqueDocOrgPath(
  expediente: string,
  docNombre: string,
  fileName: string,
): Promise<string> {
  const org = await resolverOrgIdActual();
  const exp = sanitizeStorageKey(expediente);
  const doc = sanitizeStorageKey(docNombre);
  return `${org}/embarques/${exp}/${doc}/${Date.now()}_${sanitizeFileName(fileName)}`;
}
