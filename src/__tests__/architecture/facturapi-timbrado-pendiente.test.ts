/**
 * Guardrail P0 (FacturAPI 5.0 · timbrado pendiente).
 *
 * 1. Los tres payloads (factura I, nota de crédito E y REP P) envían
 *    `idempotency_key` con el MISMO valor que el claim (`external_id`).
 * 2. Las tres emisiones detectan `status: "pending"` y responden 202 sin
 *    persistir Emitida/Timbrada ni respaldar XML.
 * 3. La liberación de claims usa la ventana segura (60 min), nunca los 3 min
 *    del umbral de gracia.
 * 4. Al promover, se limpian las columnas del intento pendiente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const leer = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("idempotency_key = claimTag en los tres CFDI", () => {
  const casos: Array<[string, RegExp]> = [
    ["supabase/functions/facturapi-emitir/helpers.ts", /idempotency_key\s*[:=]\s*ctx\.external_id/],
    ["supabase/functions/facturapi-emitir-nota-credito/helpers.ts", /idempotency_key\s*[:=]\s*ctx\.external_id/],
    // El payload del REP se construye en la etapa de emisión (index.ts es el
    // adaptador HTTP); la llave sigue ligada al claim.
    ["supabase/functions/facturapi-emitir-rep/etapaEmision.ts", /idempotency_key\s*[:=]\s*claimTag/],
  ];
  for (const [rel, re] of casos) {
    it(`${rel} envía la llave de idempotencia ligada al claim`, () => {
      const src = leer(rel);
      expect(src).toMatch(re);
      expect(src).toMatch(/external_id/);
    });
  }
});

describe("timbrado pendiente: 202 sin marcar emitido", () => {
  const casos = [
    "supabase/functions/facturapi-emitir/emitir.ts",
    "supabase/functions/facturapi-emitir-nota-credito/index.ts",
    "supabase/functions/facturapi-emitir-rep/timbrar.ts",
    "supabase/functions/facturapi-emitir-rep/index.ts",
  ];
  it("las emisiones usan el helper compartido de pendiente/idempotencia", () => {
    const fuentes = casos.map(leer).join("\n");
    expect(fuentes).toMatch(/esTimbradoPendiente/);
    expect(fuentes).toMatch(/esIdempotencyKeyEnUso/);
  });

  for (const rel of [
    "supabase/functions/facturapi-emitir/pendiente.ts",
    "supabase/functions/facturapi-emitir-nota-credito/pendiente.ts",
    "supabase/functions/facturapi-emitir-rep/pendiente.ts",
  ]) {
    it(`${rel} responde 202 y no respalda XML`, () => {
      const src = leer(rel);
      expect(src).toMatch(/cuerpoTimbradoPendiente/);
      expect(src).toMatch(/202/);
      expect(src).not.toMatch(/respaldarXmlTimbrado/);
      // No toca las columnas que la UI lee como CFDI timbrado.
      expect(src).not.toMatch(/uuid_fiscal|estado:\s*"Emitida"|estado_rep:\s*"Timbrado"/);
    });
  }
});

describe("liberación de claims con ventana segura", () => {
  const casos = [
    "supabase/functions/facturapi-recuperar-claim/recuperar.ts",
    "supabase/functions/facturapi-recuperar-claim/recuperar.nc.ts",
    "supabase/functions/facturapi-recuperar-claim/recuperar.pago.ts",
  ];
  for (const rel of casos) {
    it(`${rel} libera con MIN_EDAD_LIBERACION_MINUTOS`, () => {
      const src = leer(rel);
      expect(src).toMatch(/MIN_EDAD_LIBERACION_MINUTOS/);
      // El umbral de gracia (3 min) ya no decide liberaciones.
      expect(src).not.toMatch(/p_min_edad_minutos:\s*MIN_EDAD_MINUTOS/);
      expect(src).not.toMatch(/MIN_EDAD_MINUTOS\s*\*\s*60_000/);
    });

    it(`${rel} limpia las columnas del intento pendiente al promover`, () => {
      expect(leer(rel)).toMatch(/pendiente_id:\s*null/);
    });
  }
});
