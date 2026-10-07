/**
 * Datos del emisor (razón social, RFC, dirección, contacto) leídos desde la
 * tabla `configuracion` (categoría `empresa`). Se usan en todos los PDFs.
 *
 * Vive en la capa de servicios (no en `src/pdf/`) para mantener la
 * separación de responsabilidades: la capa PDF no debe hablar directo con
 * Supabase. Cache TTL corto en memoria; futuro: migrar a React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EmisorInfo } from "@/pdf/components/BrandHeader";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";
import { getAuthSnapshot } from "@/lib/auth/authSnapshot";

const TTL_MS = 5 * 60 * 1000; // 5 minutos
let cache: { organizationId: string; userId: string | null; value: EmisorInfo; expiresAt: number } | null = null;
let cacheGeneration = 0;

const FALLBACK: EmisorInfo = {
  razonSocial: "Empresa",
  subtitulo: "",
  rfc: "",
  direccion: "",
  contacto: "",
};

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

export async function fetchEmisorEmpresa(): Promise<EmisorInfo> {
  const scope = captureAuthOperationScope();
  const { userId } = getAuthSnapshot();
  const organizationId = scope.organizationId;
  if (!organizationId) throw new Error("Selecciona una organización antes de cargar el emisor.");
  // Mantiene la firma de los generadores y queryFn existentes, pero verifica
  // que el tenant del servidor ya coincide con el que solicitó el documento.
  const { data: serverOrg, error: scopeError } = await supabase.rpc("org_scope");
  scope.assertCurrent();
  if (scopeError) throw scopeError;
  if (serverOrg !== organizationId) {
    throw new Error("La organización activa aún no está sincronizada. Intenta de nuevo.");
  }
  const now = Date.now();
  if (cache?.organizationId === organizationId && cache.userId === userId && cache.expiresAt > now) return cache.value;
  const generation = cacheGeneration;

  const { data, error } = await supabase
    .from("configuracion")
    .select("clave, valor")
    .eq("organization_id", organizationId)
    .eq("categoria", "empresa");

  scope.assertCurrent();
  if (error) throw error;
  if (!data) throw new Error("No se pudo leer la configuración del emisor.");

  const byKey = new Map<string, unknown>(data.map((r) => [r.clave, r.valor]));
  const nombre = toStr(byKey.get("nombre")).trim();
  const email = toStr(byKey.get("email")).trim();
  const telefono = toStr(byKey.get("telefono")).trim();
  const contacto = [telefono, email].filter(Boolean).join("  ·  ");

  const value: EmisorInfo = {
    razonSocial: nombre || FALLBACK.razonSocial,
    subtitulo: toStr(byKey.get("subtitulo")).trim(),
    rfc: toStr(byKey.get("rfc")).trim(),
    direccion: toStr(byKey.get("direccion_fiscal")).trim(),
    contacto,
  };

  // La primera lectura en vuelo también puede estar compartida por React
  // Query: no basta con evitar el TTL; tampoco debe devolver el valor previo.
  if (generation !== cacheGeneration) return fetchEmisorEmpresa();
  cache = { organizationId, userId, value, expiresAt: now + TTL_MS };
  return value;
}

/** Invalida el cache TTL (útil tras guardar configuración de empresa). */
export function invalidarEmisorCache(): void {
  cacheGeneration += 1;
  cache = null;
}
