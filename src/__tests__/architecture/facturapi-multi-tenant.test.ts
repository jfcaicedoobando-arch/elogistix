/**
 * Guardrail v13.136.0 / v13.136.4 — Las 6 edge functions de FacturApi (emitir,
 * cancelar, emitir/cancelar REP y emitir/cancelar nota de crédito) deben:
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
  "supabase/functions/facturapi-emitir-nota-credito/index.ts",
  "supabase/functions/facturapi-cancelar-nota-credito/index.ts",
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

/**
 * Guardrail de versión del SDK: el import de Deno debe estar PINEADO a la
 * versión exacta que validamos (sin `^`, `~` ni etiquetas flotantes) y no debe
 * existir más de una versión importada. Un specifier flotante ya nos rompió el
 * boot del worker antes (`Could not find constraint 'facturapi@5'`).
 */
describe("facturapi SDK version pin", () => {
  const SDK_VERSION = "5.0.0";
  const helperSrc = readFileSync(
    join(ROOT, "supabase/functions/_shared/facturapiClient.ts"),
    "utf8",
  );

  it(`importa exactamente npm:facturapi@${SDK_VERSION}`, () => {
    expect(helperSrc).toContain(`import FacturapiDefault from "npm:facturapi@${SDK_VERSION}";`);
  });

  it("no usa rangos ni etiquetas flotantes en el import", () => {
    const imports = helperSrc.match(/from\s+["']npm:facturapi@[^"']+["']/g) ?? [];
    expect(imports).toHaveLength(1);
    expect(imports[0]).not.toMatch(/[\^~]|@latest|@\d+["']|@\d+\.\d+["']/);
  });

  it("no queda ninguna otra versión del SDK importada en las edge functions", () => {
    const versiones = new Set(
      [...helperSrc.matchAll(/npm:facturapi@([\d.]+)/g)].map((m) => m[1]),
    );
    expect([...versiones]).toEqual([SDK_VERSION]);
  });
});


/**
 * Guardrail Paso 15 — el fallback legado fue retirado. Ninguna edge function de
 * FacturApi (ni el resolver compartido) puede volver a leer la key global
 * `FACTURAPI_KEY` ni los secrets `LEGACY_FACTURAPI_*`. Sí se permiten los
 * secrets NOMBRADOS por organización, que se leen vía `secretName` resuelto
 * desde `facturapi_credenciales`.
 */
describe("facturapi sin fallback legado (Paso 15)", () => {
  const RESOLVER = "supabase/functions/_shared/facturapiAuth.ts";
  const ARCHIVOS = [RESOLVER, "supabase/functions/_shared/facturapiClient.ts", ...FILES];

  for (const rel of ARCHIVOS) {
    it(`${rel} no lee Deno.env.get("FACTURAPI_KEY") ni LEGACY_FACTURAPI_*`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/Deno\.env\.get\(\s*["'`]FACTURAPI_KEY["'`]\s*\)/);
      expect(src).not.toMatch(/Deno\.env\.get\(\s*["'`]LEGACY_FACTURAPI_[A-Z_]*["'`]\s*\)/);
    });
  }

  it("el resolver no conserva ninguna función de fallback legado", () => {
    const src = readFileSync(join(ROOT, RESOLVER), "utf8");
    expect(src).not.toMatch(/legacyFallback/);
    // La lectura por secret nombrado por organización sigue permitida.
    expect(src).toMatch(/Deno\.env\.get\(secretName\)/);
  });
});
