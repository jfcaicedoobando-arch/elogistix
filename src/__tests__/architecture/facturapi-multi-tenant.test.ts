/**
 * Guardrail v13.136.0 / v13.136.4 — Las 4 edge functions de FacturApi deben:
 *   1. Resolver la API key vía el helper compartido `_shared/facturapiAuth.ts`
 *      (multi-tenant por organización) — directamente o a través del SDK helper
 *      `_shared/facturapiClient.ts` (`getFacturapiClient`).
 *   2. Llamar a FacturApi exclusivamente a través del SDK oficial. No deben
 *      contener `fetch("https://www.facturapi.io/...")` ni `basicAuthHeader`.
 *
 * Si una función se salta cualquiera de las dos reglas, esta prueba lo detecta:
 * single-tenant rompería el aislamiento entre clientes y `fetch` manual
 * reintroduciría bugs de payload que el SDK ya resuelve.
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
    it(`${rel} resuelve la API key vía helper multi-tenant`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).toContain('from "../_shared/facturapiAuth.ts"');
      // Acepta la forma directa o vía getFacturapiClient (que internamente la llama).
      const usaDirecto = /resolveFacturapiKey\(\s*supabase/.test(src);
      const usaSdkHelper = /getFacturapiClient\(\s*supabase/.test(src);
      expect(usaDirecto || usaSdkHelper).toBe(true);
    });

    it(`${rel} NO declara una const FACTURAPI_KEY a nivel módulo (multi-tenant)`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/^\s*const\s+FACTURAPI_KEY\s*=\s*Deno\.env\.get/m);
    });
  }
});

describe("facturapi SDK-only guardrail (v13.136.4)", () => {
  for (const rel of FILES) {
    it(`${rel} no hace fetch directo a facturapi.io`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/fetch\([^)]*facturapi\.io/);
    });

    it(`${rel} no usa basicAuthHeader (la auth la hace el SDK)`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/basicAuthHeader\s*\(/);
    });

    it(`${rel} sólo importa el SDK desde el helper compartido`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/from\s+["']npm:facturapi/);
    });
  }

  it("sólo _shared/facturapiClient.ts referencia npm:facturapi", () => {
    const helperSrc = readFileSync(
      join(ROOT, "supabase/functions/_shared/facturapiClient.ts"),
      "utf8",
    );
    expect(helperSrc).toMatch(/npm:facturapi/);
  });
});
