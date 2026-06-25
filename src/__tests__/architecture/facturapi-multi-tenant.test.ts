/**
 * Guardrail v13.136.0 — Las 4 edge functions de FacturApi deben resolver la API key
 * vía el helper compartido `_shared/facturapiAuth.ts` (multi-tenant por organización).
 *
 * Si una nueva función o un refactor deja de pasar por el helper, esta prueba lo
 * detecta antes de que llegue a producción: una org sin credenciales podría
 * timbrar contra la cuenta de otra org si el código lee `FACTURAPI_KEY` global.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const FILES = [
  "supabase/functions/facturapi-emitir/index.ts",
  "supabase/functions/facturapi-cancelar/index.ts",
  "supabase/functions/facturapi-emitir-rep/index.ts",
  "supabase/functions/facturapi-cancelar-rep/index.ts",
];

describe("facturapi multi-tenant guardrail", () => {
  for (const rel of FILES) {
    it(`${rel} importa y usa resolveFacturapiKey`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain('from "../_shared/facturapiAuth.ts"');
      expect(src).toMatch(/resolveFacturapiKey\(\s*supabase/);
    });

    it(`${rel} NO declara una const FACTURAPI_KEY a nivel módulo (multi-tenant)`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      // Acepta el `void Deno.env.get("FACTURAPI_KEY")` de compatibilidad,
      // pero rechaza `const FACTURAPI_KEY = Deno.env.get(...)` que recrearía
      // el modelo single-tenant.
      expect(src).not.toMatch(/^\s*const\s+FACTURAPI_KEY\s*=\s*Deno\.env\.get/m);
    });
  }
});
