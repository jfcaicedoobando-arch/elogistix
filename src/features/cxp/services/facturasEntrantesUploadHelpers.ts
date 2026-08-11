/**
 * Helpers de la subida al buzón CxP (hash del archivo y traducción de errores
 * de almacenamiento). Extraídos de `facturasEntrantesUpload.ts` para respetar
 * el límite de 200 líneas (Power of 10).
 */

/** SHA-256 hex del contenido del archivo (llave de deduplicación del buzón). */
export async function calcularHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** v13.419.0 — Traduce fallos de almacenamiento (RLS/permisos) a lenguaje claro. */
export function mensajeErrorStorage(error: { message?: string } | null): string | null {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return null;
  if (
    msg.includes("row-level security") ||
    msg.includes("unauthorized") ||
    msg.includes("permission")
  ) {
    return "No tienes permiso para guardar archivos en el buzón de este embarque. Verifica que el embarque pertenezca a tu organización y que tu rol permita subir facturas.";
  }
  return null;
}
