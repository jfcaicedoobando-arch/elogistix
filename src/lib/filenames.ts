/**
 * Helpers para prefijar los nombres de archivos descargables con el nombre de
 * la organización configurada en `configuracion.empresa.nombre`.
 *
 * Regla global: `{Org}_{nombre}.{ext}` para PDFs generados en cliente
 * (cotizaciones, proformas, rentabilidad, reportes, etc.).
 *
 * Reusa el cache de 5 min de `fetchEmisorEmpresa`, así que agregar el prefijo
 * no añade queries perceptibles.
 */
import { fetchEmisorEmpresa } from "@/features/configuracion/services";

/**
 * Normaliza el nombre de la organización: sin acentos, sin caracteres
 * inseguros, guiones bajos en lugar de espacios. Máx 40 chars.
 */
export function slugifyOrg(nombre: string | null | undefined): string {
  const s = (nombre ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return s || "org";
}

/** Devuelve el slug del emisor configurado. */
export async function getOrgFilenameSlug(): Promise<string> {
  try {
    const emisor = await fetchEmisorEmpresa();
    return slugifyOrg(emisor.razonSocial);
  } catch {
    return "org";
  }
}

/** Devuelve `{Org}_{name}`. Usar directamente como argumento de `descargarPdf`. */
export async function withOrgPrefix(name: string): Promise<string> {
  const slug = await getOrgFilenameSlug();
  return `${slug}_${name}`;
}
