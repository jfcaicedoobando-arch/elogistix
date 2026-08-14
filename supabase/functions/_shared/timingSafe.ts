/**
 * Ola 13 · R4EF-05 — Comparación constante en tiempo, extraída de
 * `process-email-queue/queueAuth.ts` (EF-13/REF-04). Fuente única para los
 * comparadores de llaves server-to-server.
 *
 * Nota: la comparación de longitudes no es constante en tiempo (igual que en la
 * versión original); las llaves comparadas son de longitud fija/conocida.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
