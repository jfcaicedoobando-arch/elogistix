/**
 * `requireFixture.ts` — helper para specs que dependen de datos/env sembrados.
 *
 * Motivación (Auditoría E2E, v13.312.15): antes usábamos `test.skip(!X, "…")`
 * para env-flags como `E2E_FISCAL`, `E2E_HAS_SEED`, etc. En CI eso produce
 * "falsos verdes" — el job termina en éxito sin verificar nada. Este helper
 * permite promover esos skips a fallo cuando `E2E_STRICT_FIXTURES=1`.
 *
 * Uso en specs:
 *
 *   import { requireFixture } from "../fixtures/requireFixture";
 *   test.beforeAll(() => {
 *     requireFixture(Boolean(process.env.E2E_FISCAL), "E2E_FISCAL=1 requerido");
 *   });
 *
 * Comportamiento:
 *   - Si `ok === true` → no hace nada.
 *   - Si `ok === false`:
 *       · `E2E_STRICT_FIXTURES=1` → lanza `Error` con `reason` (test falla).
 *       · en cualquier otro caso → `test.skip(true, reason)` (skip suave).
 *
 * El workflow expone `E2E_STRICT_FIXTURES` como input `strict_fixtures` de
 * `workflow_dispatch`. En local se usa la vía skip para no bloquear a devs
 * sin acceso a staging.
 */
import { test } from "./testBase";

export function requireFixture(ok: boolean, reason: string): void {
  if (ok) return;
  const strict = process.env.E2E_STRICT_FIXTURES === "1";
  if (strict) {
    throw new Error(`[requireFixture] ${reason} (E2E_STRICT_FIXTURES=1)`);
  }
  test.skip(true, reason);
}
