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

const TTL_MS = 5 * 60 * 1000; // 5 minutos
let cache: { value: EmisorInfo; expiresAt: number } | null = null;

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
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const { data, error } = await supabase
    .from("configuracion")
    .select("clave, valor")
    .eq("categoria", "empresa");

  if (error || !data) {
    return FALLBACK;
  }

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

  cache = { value, expiresAt: now + TTL_MS };
  return value;
}

/** Invalida el cache TTL (útil tras guardar configuración de empresa). */
export function invalidarEmisorCache(): void {
  cache = null;
}
