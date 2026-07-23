/**
 * FIX-R2-03 · Test de deriva: ningún código `LC_*` mencionado en migraciones o
 * lanzado desde código de aplicación puede faltar en `LC_CODE_MESSAGES`.
 *
 * Grepea las migraciones + los app-raised conocidos y compara contra el
 * catálogo. Si alguien añade `RAISE EXCEPTION 'LC_NUEVO_CODIGO...'` en una
 * migración y no registra la traducción, este test falla.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LC_CODE_MESSAGES } from "../lcCodeMessages";

const MIG_DIR = join(process.cwd(), "supabase", "migrations");
const LC_TOKEN = /LC_[A-Z0-9_]+/g;

// Códigos usados internamente por catálogos/tests que no requieren mensaje
// amigable en UI (o son estrictamente de infraestructura de test).
const IGNORED = new Set<string>([
  "LC_CODE_MESSAGES",
  "LC_CODE",
]);

function collectFromDir(dir: string): Set<string> {
  const out = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".sql")) continue;
    const body = readFileSync(join(dir, f), "utf8");
    for (const m of body.matchAll(LC_TOKEN)) {
      const code = m[0];
      if (!IGNORED.has(code)) out.add(code);
    }
  }
  return out;
}

describe("Cobertura de códigos LC_*", () => {
  it("todo LC_* que aparece en migraciones tiene mensaje en LC_CODE_MESSAGES", () => {
    const found = collectFromDir(MIG_DIR);
    const missing = [...found].filter((c) => !(c in LC_CODE_MESSAGES)).sort();
    expect(
      missing,
      `Faltan mensajes amigables para códigos LC_*. Añádelos a src/lib/errors/lcCodeMessages.ts:\n${missing.join("\n")}`,
    ).toEqual([]);
  });
});
