/**
 * Guardrail (13.137.15): los servicios del módulo fiscal NO deben tragar
 * errores en bloques `catch` sin reportarlos a Sentry. La regla es:
 * o se re-lanza (deja que React Query lo reporte vía MutationCache), o se
 * llama a `reportCaughtError` / `Sentry.captureException`.
 *
 * Antes de este test, un `catch (err) { toast.error(...) }` silencioso pasaba
 * desapercibido y los errores en timbrado/REP/notas de crédito quedaban sólo
 * en consola del usuario.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SERVICES_DIR = path.join(ROOT, "src/features/facturacion/services");

function listServiceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("__")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listServiceFiles(full));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    if (entry.name === "index.ts") continue;
    out.push(full);
  }
  return out;
}

describe("Servicios fiscales reportan errores capturados", () => {
  const files = listServiceFiles(SERVICES_DIR);

  it.each(files.map((f) => path.relative(ROOT, f)))(
    "%s no traga errores en catch",
    (rel) => {
      const full = path.join(ROOT, rel);
      const src = fs.readFileSync(full, "utf-8");
      // Considera cualquier ocurrencia de catch como bloque a inspeccionar.
      if (!/\bcatch\s*\(/.test(src)) return; // sin try/catch, nada que validar
      const reporta =
        /reportCaughtError\s*\(/.test(src) ||
        /captureException\s*\(/.test(src) ||
        // Re-lanzar también es válido (React Query lo recoge).
        /throw\s+(err|error|e)\b/.test(src) ||
        /throw\s+new\s+Error/.test(src);
      expect(
        reporta,
        `${rel} usa try/catch pero ni re-lanza ni reporta a Sentry.`,
      ).toBe(true);
    },
  );
});
