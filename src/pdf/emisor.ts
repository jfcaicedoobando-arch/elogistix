/**
 * Carga los datos de la empresa emisora (razón social, RFC, etc.) desde la
 * tabla `configuracion` (categoría `empresa`) para usarlos en todos los PDFs
 * del sistema. Resultado cacheado en memoria con TTL corto para evitar pegarle
 * a la BD en cada descarga.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EmisorInfo } from "./components/BrandHeader";

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

/** Invalida la caché en memoria. Útil cuando el usuario edita `/configuracion`. */
export function invalidarEmisorCache(): void {
  cache = null;
}

export async function cargarEmisorEmpresa(): Promise<EmisorInfo> {
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
