/**
 * PR-4 · Ítem 3.7 — Cierra el gap de tests SQL de códigos `LC_*`.
 *
 * No ejecuta Postgres (el sandbox de vitest no lo tiene). En su lugar verifica
 * estáticamente el contrato end-to-end de cada guarda crítica:
 *   1. Existe al menos una migración que emite `RAISE EXCEPTION 'LC_XXX: …'`.
 *   2. El código está mapeado en `LC_CODE_MESSAGES` (mensaje amigable al usuario).
 *   3. `translateLcCode()` reconoce el código dentro de una cadena con prefijo
 *      PGRST/otro (mismo contrato que usa `getErrorMessage`).
 *
 * Codes cubiertos por este test:
 *   - LC_CXP_DESCUADRE     — descuadre conceptos vs subtotal (aprobar CxP)
 *   - LC_TC_NO_DISPONIBLE  — tipo de cambio faltante en flujo NC/pagos
 *   - LC_CIERRE_SOLO_RPC   — cierre de embarque sólo vía RPC
 *   - LC_EMBARQUE_BLOQUEADO — embarque con dependencias fiscales o cerrado
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LC_CODE_MESSAGES } from "@/lib/errors/lcCodeMessages";
import { translateLcCode } from "@/lib/errors/lcCodes";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const HOOKS_DIR = join(process.cwd(), "src");

function readAllMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  return files.map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8")).join("\n");
}

function grepRepo(pattern: RegExp, dir: string): string[] {
  const results: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const src = readFileSync(full, "utf8");
      if (pattern.test(src)) results.push(full);
    }
  }
  return results;
}

describe("SQL LC_ error-code wiring (PR-4 · 3.7)", () => {
  const allSql = readAllMigrations();

  const SQL_RAISED_CODES = [
    "LC_CXP_DESCUADRE",
    "LC_CIERRE_SOLO_RPC",
    "LC_EMBARQUE_BLOQUEADO",
  ] as const;

  it.each(SQL_RAISED_CODES)(
    "migración emite RAISE EXCEPTION '%s: …' al menos una vez",
    (code) => {
      const re = new RegExp(`RAISE\\s+EXCEPTION\\s+'${code}\\s*:`, "i");
      expect(re.test(allSql), `Ninguna migración emite ${code}`).toBe(true);
    },
  );

  it("LC_TC_NO_DISPONIBLE se lanza desde el hook de NC (frontend guard)", () => {
    // Este código vive en la capa cliente porque el TC se resuelve en frontend
    // antes de invocar la RPC (evita un round-trip). El guard es equivalente.
    const hits = grepRepo(/throw new Error\("LC_TC_NO_DISPONIBLE/, HOOKS_DIR);
    expect(hits.length, "Se esperaba al menos un `throw` con LC_TC_NO_DISPONIBLE").toBeGreaterThan(0);
  });

  const ALL_CODES = [...SQL_RAISED_CODES, "LC_TC_NO_DISPONIBLE"] as const;

  it.each(ALL_CODES)("`%s` tiene mensaje amigable en LC_CODE_MESSAGES", (code) => {
    expect(LC_CODE_MESSAGES[code], `Falta mensaje amigable para ${code}`).toBeTruthy();
  });

  it.each(ALL_CODES)("translateLcCode reconoce `%s` embebido con prefijo PGRST", (code) => {
    const raw = `PGRST: ${code}: detalle irrelevante`;
    const translated = translateLcCode(raw);
    expect(translated).not.toBe(raw);
    expect(translated).toBe(LC_CODE_MESSAGES[code]);
  });
});
