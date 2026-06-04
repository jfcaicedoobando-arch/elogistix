/**
 * Schema Zod para la respuesta de la RPC `idempotency_claim`.
 *
 * La RPC devuelve uno de:
 *   - `{ __idempotency_pending: true }` — primer claim, debe ejecutarse la op.
 *   - `{ path: string, fileName?: string, ... }` — respuesta cacheada.
 *
 * Usamos `.passthrough()` para no descartar campos extra que la RPC pueda
 * añadir a futuro.
 */
import { z } from "zod";

const pendingClaimSchema = z
  .object({ __idempotency_pending: z.literal(true) })
  .passthrough();

const cachedClaimSchema = z
  .object({
    path: z.string().min(1),
    fileName: z.string().optional(),
  })
  .passthrough();

export const idempotencyClaimSchema = z.union([
  pendingClaimSchema,
  cachedClaimSchema,
]);

export type IdempotencyClaim = z.infer<typeof idempotencyClaimSchema>;
export type CachedIdempotencyClaim = z.infer<typeof cachedClaimSchema>;

/** True si el claim es la respuesta cacheada (tiene `path`). */
export function isCachedClaim(
  claim: IdempotencyClaim,
): claim is CachedIdempotencyClaim {
  return "path" in claim && typeof claim.path === "string";
}
