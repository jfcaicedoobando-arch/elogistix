/**
 * Helpers de hashing usados por el upload idempotente de documentos de embarque.
 * Aislados aquí para mantener `services/embarque/documentos.ts` ≤200 líneas.
 */

/**
 * SHA-256 del contenido del archivo en hex. Usado como huella estable para
 * idempotencia: dos uploads del mismo File siempre producen el mismo hash.
 */
export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convierte un hex >=32 chars a formato UUID v4-like determinístico. */
export function hexToUuid(hex: string): string {
  const h = hex.slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
