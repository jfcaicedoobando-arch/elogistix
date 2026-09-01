/**
 * Validación de UUID compartida por edge functions.
 *
 * Formato tolerado: 8-4-4-4-12 hex (igual que `logger.ts`). NO se exige la
 * versión RFC 4122 [1-5] ni la variante [89ab] porque el sistema usa
 * identificadores fijos legítimos como la organización principal
 * `00000000-0000-0000-0000-000000000001`: exigir versión/variante los
 * rechazaría con 400 y rompería la captura de XML/PDF.
 */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}
